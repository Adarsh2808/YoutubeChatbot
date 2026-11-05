import { useState } from 'react';

function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = async (e) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    setIsProcessing(true);
    
    try {
      const res = await fetch('https://youtubechatbot-ifof.onrender.com/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setIsReady(true);
      } else {
        alert(data.error || "Failed to process video");
      }
    // eslint-disable-next-line no-unused-vars
    } catch (error) {
      alert("Connection failed. Is Flask running?");
    } finally {
      setIsProcessing(false);
    }
  };

  const askQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    const newChat = [...chat, { role: 'user', text: question }];
    setChat(newChat);
    setQuestion('');
    setIsLoading(true);

    try {
      const res = await fetch('https://youtubechatbot-ifof.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setChat([...newChat, { role: 'bot', text: data.answer || `Error: ${data.error}` }]);
    // eslint-disable-next-line no-unused-vars
    } catch (error) {
      setChat([...newChat, { role: 'bot', text: 'Connection failed.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[90vh]">
        
        <div className="bg-slate-950 p-6 border-b border-slate-800 text-center flex flex-col items-center justify-center">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            YouTube RAG Assistant
          </h1>
        </div>

        {!isReady ? (
          // Step 1: URL Input Screen
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
            <h2 className="text-xl text-slate-300">Paste a YouTube Link to Begin</h2>
            <form onSubmit={handleSetup} className="w-full max-w-lg flex flex-col gap-4">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={isProcessing}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-5 py-3 outline-none focus:border-indigo-500 transition-colors"
              />
              <button 
                type="submit" 
                disabled={isProcessing}
                className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Processing Transcript (Takes ~1 min)...' : 'Load Video'}
              </button>
            </form>
          </div>
        ) : (
          // Step 2: Chat Interface
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
              {chat.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <p>Transcript loaded! Ask your questions below.</p>
                </div>
              )}
              {chat.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 rounded-2xl max-w-[80%] leading-relaxed ${
                    msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-800 border border-slate-700 rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                   <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 rounded-bl-sm flex items-center gap-3">
                    <span className="text-sm text-cyan-400 animate-pulse">Generating answer...</span>
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={askQuestion} className="p-5 bg-slate-950 border-t border-slate-800 flex gap-4">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isLoading}
                placeholder="Type your question here..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-6 py-4 outline-none focus:border-indigo-500 disabled:opacity-50"
              />
              <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-xl font-bold disabled:opacity-50">
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
