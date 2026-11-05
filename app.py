import os
import re
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# LangChain and YouTube imports
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_core.output_parsers import StrOutputParser

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Enable CORS so your React app can communicate with Flask
CORS(app)

# Global variable to store the RAG chain
global_chain = None

def extract_video_id(url):
    """Extracts the YouTube video ID from a standard or short URL."""
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
    return match.group(1) if match else None

def format_docs(docs):
    """Combines retrieved documents into a single string."""
    return "\n\n".join(doc.page_content for doc in docs)

@app.route('/api/process', methods=['POST'])
def process_video():
    global global_chain
    data = request.json
    video_url = data.get('url')
    
    if not video_url:
        return jsonify({"error": "No URL provided"}), 400

    video_id = extract_video_id(video_url)
    if not video_id:
        return jsonify({"error": "Invalid YouTube URL"}), 400

    try:
        # 1. Fetch Transcript - FIXED: Using the new v1.0.0+ .fetch() method
        print(f"Fetching transcript for video ID: {video_id}")
        transcript_list = YouTubeTranscriptApi().fetch(video_id, languages=["en"])
        transcript = " ".join([chunk.text for chunk in transcript_list])
        
        # 2. Split Text
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100
        )
        chunks = text_splitter.create_documents([transcript])
        print(f"Split into {len(chunks)} chunks.")

        # 3. Initialize Embeddings
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )

        # 4. Build FAISS Vector Store with Batching
        print("Building vector database in batches...")
        batch_size = 90
        vector_store = None
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            if vector_store is None:
                vector_store = FAISS.from_documents(batch, embeddings)
            else:
                if i > 0:
                    print("Waiting 60 seconds for API quota to reset...")
                    time.sleep(60) 
                vector_store.add_documents(batch)
            print(f"Processed up to chunk {min(i + batch_size, len(chunks))}")

        # 5. Setup Retriever
        retriever = vector_store.as_retriever(search_kwargs={'k': 4})

        # 6. Setup LLM and Prompt
        llm = ChatGoogleGenerativeAI(
            model="gemini-3.5-flash", 
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=0.3
        )

        prompt = PromptTemplate(
            template="""
            You are a helpful assistant.
            Answer ONLY from the provided transcript context.
            If the context is insufficient, just say you don't know.

            Context: {context}
            Question: {question}
            """,
            input_variables=['context', 'question']
        )

        # 7. Tie it all together using LCEL
        parallel_chain = RunnableParallel({
            'context': retriever | RunnableLambda(format_docs),
            'question': RunnablePassthrough()
        })
        
        parser = StrOutputParser()
        
        # Save to global variable to use in the /api/chat route
        global_chain = parallel_chain | prompt | llm | parser

        return jsonify({"message": "Video processed successfully!"}), 200

    except TranscriptsDisabled:
        return jsonify({"error": "No captions available for this video."}), 400
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    global global_chain
    
    if global_chain is None:
         return jsonify({"error": "No video processed yet. Please process a URL first."}), 400

    data = request.json
    question = data.get('question')

    if not question:
        return jsonify({"error": "No question provided"}), 400

    try:
        answer = global_chain.invoke(question)
        return jsonify({"answer": answer}), 200
        
    except Exception as e:
        print(f"Chat Error: {e}")
        return jsonify({"error": "Failed to generate answer."}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)