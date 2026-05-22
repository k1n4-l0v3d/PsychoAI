package chat

import "strings"

type chipRule struct {
	keywords []string
	chip     string
}

var chipRules = []chipRule{
	{[]string{"тревог", "паник", "anxiety", "panic", "nervou"}, "🧘 Дыхание 4-7-8"},
	{[]string{"сон", "усталост", "засн", "sleep", "tired", "insomni"}, "🧘 Медитация перед сном"},
	{[]string{"мысл", "негатив", "thought", "cognitive", "кпт", "cbt"}, "🧘 КПТ-техника"},
	{[]string{"статьи", "книг", "ресурс", "articles", "books", "resources", "read"}, "📚 Найти статьи"},
}

func analyzeChips(text string) []string {
	lower := strings.ToLower(text)
	var chips []string
	seen := map[string]bool{}

	for _, rule := range chipRules {
		for _, kw := range rule.keywords {
			if strings.Contains(lower, kw) && !seen[rule.chip] {
				chips = append(chips, rule.chip)
				seen[rule.chip] = true
				break
			}
		}
	}

	if !seen["📔 Записать в дневник"] {
		chips = append(chips, "📔 Записать в дневник")
	}

	return chips
}
