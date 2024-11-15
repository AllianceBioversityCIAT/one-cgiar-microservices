'use client';
import { ArrowUp, Paperclip } from 'lucide-react';
import { Button } from '../ui/button';
import { useEffect, useRef, useState } from 'react';
import { Textarea } from '../ui/textarea';

export function ChatForm() {
  const [message, setMessage] = useState('');
  const [isScrollable, setIsScrollable] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 8 * 20); // Assuming 20px per row
      textarea.style.height = `${newHeight}px`;
      setIsScrollable(textarea.scrollHeight > newHeight);
    }
  }, [message]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = () => {
    if (message.trim()) {
      console.log('Sending message:', message);
      setMessage('');
    }
  };

  return (
    <div className="mt-6 flex w-full flex-col rounded-xl border border-input bg-background px-3 py-2">
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask a follow up..."
        className={`max-h-[160px] min-h-10 w-full resize-none border-none px-1 text-gray-900 outline-none ${isScrollable ? 'overflow-y-auto' : 'overflow-hidden'}`}
        style={{ height: 'auto' }}
        rows={1}
      />

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="h-8 w-8 rounded-lg text-gray-500 hover:text-gray-700"
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Button
          className="h-8 w-8 rounded-lg"
          disabled={!message.trim()}
          onClick={sendMessage}
          aria-label="Send message"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
