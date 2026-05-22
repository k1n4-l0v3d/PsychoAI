import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  chips: string[]
  onChip: (chip: string) => void
}

export default function ChipSuggestions({ chips, onChip }: Props) {
  return (
    <AnimatePresence>
      {chips.length > 0 && (
        <div className="chips-row">
          {chips.map((chip, i) => (
            <motion.button
              key={chip}
              className="chip"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              onClick={() => onChip(chip)}
            >
              {chip}
            </motion.button>
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
