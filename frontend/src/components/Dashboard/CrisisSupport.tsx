import { Phone, MessageSquare, AlertTriangle } from 'lucide-react'

export default function CrisisSupport() {
  return (
    <div className="crisis-card">
      <div className="crisis-card__header">
        <div className="crisis-card__icon">
          <AlertTriangle size={18} color="rgba(239,68,68,0.9)" />
        </div>
        <div className="crisis-card__title">Нужна срочная помощь?</div>
      </div>
      <div className="crisis-card__desc">
        Если вам сейчас тяжело — вы не одни. Специалисты готовы помочь прямо сейчас, бесплатно и анонимно.
      </div>
      <div className="crisis-card__actions">
        <a href="tel:88002000122" className="crisis-btn crisis-btn--primary">
          <Phone size={15} />
          8-800-2000-122 — бесплатно
        </a>
        <a
          href="https://telefon-doveria.ru"
          target="_blank"
          rel="noopener noreferrer"
          className="crisis-btn crisis-btn--secondary"
        >
          <MessageSquare size={15} />
          Онлайн-чат поддержки
        </a>
      </div>
    </div>
  )
}
