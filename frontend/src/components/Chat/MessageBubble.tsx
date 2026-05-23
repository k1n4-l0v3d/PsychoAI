import { motion } from 'framer-motion'
import { marked } from 'marked'

marked.setOptions({ breaks: true })

interface Message { id: string; role: 'user' | 'assistant'; content: string }

export default function MessageBubble({ message }: { message: Message }) {
  const isAssistant = message.role === 'assistant'

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
    </motion.div>
  )
}
