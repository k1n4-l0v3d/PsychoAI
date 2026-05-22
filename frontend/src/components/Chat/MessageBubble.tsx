import { motion } from 'framer-motion'

interface Message { id: string; role: 'user' | 'assistant'; content: string }

export default function MessageBubble({ message }: { message: Message }) {
  return (
    <motion.div
      className={`message message--${message.role}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      layout
    >
      <div className="message-bubble">
        {message.content.split('\n').map((line, i, arr) => (
          <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
        ))}
      </div>
    </motion.div>
  )
}
