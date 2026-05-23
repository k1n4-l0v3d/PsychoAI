import { useState } from 'react'
import { motion } from 'framer-motion'
import { marked } from 'marked'
import { Copy, Check } from 'lucide-react'

marked.setOptions({ breaks: true })

interface Message { id: string; role: 'user' | 'assistant'; content: string }

export default function MessageBubble({ message }: { message: Message }) {
  const isAssistant = message.role === 'assistant'
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      className={`message message--${message.role}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      layout
    >
      <div className="message-bubble">
        {isAssistant ? (
          <div className="md" dangerouslySetInnerHTML={{ __html: marked.parse(message.content) as string }} />
        ) : (
          message.content.split('\n').map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))
        )}
      </div>
      {isAssistant && message.content && (
        <button className="msg-copy-btn" onClick={handleCopy} title="Копировать">
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      )}
    </motion.div>
  )
}
