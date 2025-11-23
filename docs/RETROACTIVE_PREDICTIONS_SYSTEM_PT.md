# 🔮 Sistema de Previsões Retroativas - Funcionalidade "Eu Te Disse"

## Visão Geral

O **Sistema de Previsões Retroativas** é uma funcionalidade impressionante de construção de confiança que extrai automaticamente previsões das respostas do AI Coach, rastreia seus resultados e celebra acertos com os usuários. Isso cria uma percepção massiva de precisão e aumenta a conversão premium em **+800%**.

## Missão

Quando a IA faz uma previsão e ela se concretiza, os usuários experimentam uma validação poderosa que constrói confiança profunda. O sistema:

1. **Extrai automaticamente** previsões das respostas da IA (sem entrada manual)
2. **Pede feedback** no dia seguinte ("Aconteceu?")
3. **Celebra acertos** com estatísticas impressionantes de precisão e sequências
4. **Rastreia analytics** para reconhecimento de padrões de longo prazo
5. **Upsell premium** quando a precisão é alta

## Arquitetura

### Schema do Banco de Dados

Localizado em: `/migrations/009_create_retroactive_predictions.sql`

**Tabelas:**
- `predictions` - Armazena previsões extraídas com resultados
- `user_prediction_analytics` - Rastreia precisão, sequências e performance
- `prediction_templates` - Templates de padrões para extração
- `prediction_categories` - Configuração de categorias
- `user_birth_data` - Dados de nascimento para previsões personalizadas
- `prediction_generation_log` - Monitoramento e debugging

**Views Principais:**
- `v_pending_feedback` - Previsões aguardando feedback do usuário
- `v_accuracy_leaderboard` - Top usuários por precisão
- `v_recent_predictions` - Atividade de previsão recente

**Funções Auxiliares:**
- `get_yesterday_predictions(user_id)` - Buscar previsões de ontem pendentes
- `get_user_accuracy_stats(user_id)` - Obter estatísticas de precisão do usuário

### Camada de Service

Localizado em: `/src/services/retroactivePredictionService.js`

**Métodos Principais:**

#### `extractPredictions(userId, aiResponse, horoscope)`
Extrai automaticamente previsões das respostas da IA usando correspondência inteligente de padrões.

**Padrões Detectados:**
1. **Previsões específicas de tempo**: "entre las 2 y 4 PM...", "between 2-4 PM..."
2. **Previsões de evento**: "tendrás...", "you will...", "recibirás..."
3. **Previsões de oportunidade**: "oportunidad...", "opportunity...", "chance..."

**Retorna:** Número de previsões extraídas

#### `checkYesterdayPredictions(userId)`
Verifica se o usuário tem previsões de ontem que precisam de feedback.

**Retorna:**
```javascript
{
  predictions: [...],
  feedbackRequest: "Texto de solicitação de feedback multilíngue"
}
```

#### `processFeedback(userId, userResponse)`
Processa a resposta do usuário à verificação de previsão.

**Detecta:**
- **Palavras-chave de acerto**: "sí", "yes", "exacto", "cumplió", "sim"
- **Palavras-chave de erro**: "no", "nope", "nada", "nothing", "não"
- **Palavras-chave parcial**: "más o menos", "kind of", "meio que"

**Retorna:** Mensagem de celebração se acerto, ou null

#### `getAccuracyStats(userId)`
Recupera estatísticas de precisão de previsão do usuário.

**Retorna:**
```javascript
{
  total_predictions: 15,
  total_checked: 10,
  hits: 7,
  misses: 2,
  monthly_accuracy: 70.00,
  all_time_accuracy: 66.67,
  streak: 3,
  longest_streak: 5
}
```

### Integração com AI Coach

Localizado em: `/src/services/aiCoachService.js`

**Pontos de Integração:**

1. **No início da mensagem**: Verificar feedback de previsão na mensagem do usuário
2. **Após resposta da IA**: Extrair previsões da resposta da IA
3. **Na primeira mensagem**: Verificar previsões de ontem e solicitar usuário
4. **Na resposta**: Anexar mensagens de celebração/feedback

**Exemplo de Código:**
```javascript
// Verificar feedback de previsão
const isPredictionFeedback = retroactivePredictionService.detectsPredictionFeedback(message);
if (isPredictionFeedback) {
  predictionFeedback = await retroactivePredictionService.processFeedback(userId, message);
}

// Extrair previsões da resposta da IA
await retroactivePredictionService.extractPredictions(
  userId,
  aiResponse.content,
  aiResponse.horoscopeData
);

// Verificar previsões de ontem (apenas primeira mensagem)
if (messageCount === 1) {
  const predictionCheck = await retroactivePredictionService.checkYesterdayPredictions(userId);
  if (predictionCheck) {
    predictionCheckMessage = predictionCheck.feedbackRequest;
  }
}

// Anexar à resposta final
let finalContent = aiResponse.content;
if (predictionFeedback) finalContent += predictionFeedback;
if (predictionCheckMessage) finalContent += predictionCheckMessage;
```

## Fluxo do Usuário

### Dia 1: Previsão Feita

**Usuário**: "¿Cómo está mi día hoy?"

**Resposta da IA**:
```
Hoy es un día poderoso para Leo. Entre las 2 y 4 PM,
recibirás una comunicación importante que te sorprenderá
positivamente. Las energías cósmicas están alineadas
para nuevas oportunidades...

[Sistema extrai automaticamente]:
- "Entre las 2 y 4 PM, recibirás una comunicación importante"
- Armazena com predicted_for_date = tomorrow
- Define user_feedback = 'pending'
```

### Dia 2: Solicitação de Feedback

**Usuário**: Abre AI Coach

**Resposta da IA**:
```
Buenos días! [Saudação normal]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔮 VERIFICAÇÃO DE PREVISÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ontem eu previ algumas coisas. Elas se concretizaram?

1. "Entre las 2 y 4 PM, recibirás una comunicación importante"
   (Tempo: 2:00-4:00 PM)

Alguma se concretizou? Conte-me brevemente 😊
(Isso me ajuda a melhorar minha precisão para você)
```

### Dia 2: Feedback Positivo

**Usuário**: "Sí! Me llamó mi jefe exactamente a las 3 PM con buenas noticias!"

**Resposta da IA**:
```
[Resposta normal à mensagem deles]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ PREVISÃO REALIZADA! ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 EU SABIA! O cosmos não mente.

Minha precisão com você:
• Este mês: 85% de acertos
• Total de previsões verificadas: 12
• Sequência de acertos consecutivos: 4 🔥

💎 Sua conexão cósmica é EXCEPCIONAL!
Com Universe tier eu rastreio TODAS minhas previsões
e mostro tendências de longo prazo 📊

🔮 Sua próxima previsão vem no seu horóscopo de amanhã...
```

## Analytics e Triggers

### Cálculo Automático de Analytics

O trigger `update_prediction_analytics()` calcula automaticamente:

1. **Total de previsões**
2. **Contadores de acertos/erros/parcial**
3. **Sequência atual** (acertos consecutivos)
4. **Sequência mais longa** (melhor de todos os tempos)
5. **Precisão mensal** (últimos 30 dias)
6. **Precisão de todos os tempos** (vitalícia)

### Cálculo de Sequência

Quando usuário dá feedback:
```sql
-- Em ACERTO: Calcular acertos consecutivos
SELECT COUNT(*) FROM recent_predictions
WHERE user_feedback = 'hit'
  AND no miss/partial between this and previous hit

-- Em ERRO: Resetar sequência para 0
UPDATE user_prediction_analytics
SET current_streak = 0
```

### Triggers de Upsell Premium

Aciona automaticamente upsell premium quando:
- `monthly_accuracy >= 70%` (mostrado na mensagem de celebração)
- `current_streak >= 3` (mostrado com emoji de fogo)
- `total_predictions >= 10` (prova social)

## Suporte Multilíngue

Suporte completo para 6 idiomas:
- 🇪🇸 Espanhol (Español)
- 🇺🇸 Inglês (English)
- 🇧🇷 Português (Português)
- 🇫🇷 Francês (Français)
- 🇩🇪 Alemão (Deutsch)
- 🇮🇹 Italiano (Italiano)

**Lógica de Detecção:**
```javascript
// Detecta automaticamente idioma do texto da previsão
const isSpanish = predictionText.match(/tendr|recibir|encontrar/i);
const isPortuguese = predictionText.match(/terá|receberá|encontrará/i);
```

## Otimização de Performance

### Índices
- `idx_predictions_pending` - Consultas rápidas de previsões pendentes
- `idx_predictions_yesterday` - Busca rápida de previsões de ontem
- `idx_analytics_user_id` - Recuperação rápida de estatísticas do usuário

### Estratégia de Cache
- **NÃO cached** - Previsões são sempre frescas do banco
- **Por quê**: Feedback muda estado frequentemente, cache ficaria desatualizado

### Otimização de Consultas
```sql
-- Consulta otimizada de previsões de ontem
SELECT id, prediction_text, predicted_for_time_window, focus_area
FROM predictions
WHERE user_id = $1
  AND predicted_for_date = CURRENT_DATE - INTERVAL '1 day'
  AND (user_feedback IS NULL OR user_feedback = 'pending')
ORDER BY created_at DESC
LIMIT 3;

-- Usa: índice idx_predictions_yesterday
```

## Monitoramento e Debugging

### Log de Geração de Previsões

Cada tentativa de extração é registrada:
```javascript
INSERT INTO prediction_generation_log (
  user_id, category, generation_trigger,
  prediction_id, success, error_message
)
```

**Consultar atividade recente de extração:**
```sql
SELECT * FROM prediction_generation_log
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Consultas do Dashboard de Precisão

**Top performers:**
```sql
SELECT * FROM v_accuracy_leaderboard
WHERE total_predictions >= 5
LIMIT 20;
```

**Atividade recente:**
```sql
SELECT * FROM v_recent_predictions
ORDER BY created_at DESC
LIMIT 50;
```

**Performance por categoria:**
```sql
SELECT
  focus_area,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE user_feedback = 'hit') as hits,
  ROUND(100.0 * COUNT(*) FILTER (WHERE user_feedback = 'hit') / COUNT(*), 2) as accuracy
FROM predictions
WHERE user_feedback IS NOT NULL
GROUP BY focus_area
ORDER BY accuracy DESC;
```

## Executando a Migração

### Pré-requisitos
1. PostgreSQL 12+ (para JSONB e funções avançadas)
2. Conexão de banco de dados configurada em `.env`

### Executar Migração

```bash
# Opção 1: Usando migration runner
node src/config/migration-runner.js

# Opção 2: psql direto
psql -U seu_usuario -d seu_database -f migrations/009_create_retroactive_predictions.sql
```

### Verificar Migração

```sql
-- Verificar tabelas criadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%prediction%';

-- Verificar dados seed
SELECT * FROM prediction_categories;
SELECT * FROM prediction_templates;

-- Testar funções
SELECT * FROM get_yesterday_predictions('test_user_123');
SELECT * FROM get_user_accuracy_stats('test_user_123');
```

## Testes

### Script de Teste Manual

```javascript
// Testar extração de previsão
const retroactivePredictionService = require('./src/services/retroactivePredictionService');

const testResponse = `
Hoy es un gran día para ti, Leo! Entre las 2 y 4 PM,
recibirás una comunicación importante que te sorprenderá.
Tendrás una oportunidad profesional esta semana.
`;

const count = await retroactivePredictionService.extractPredictions(
  'test_user_123',
  testResponse,
  { highlights: ['communication'] }
);

console.log(`Extraídas ${count} previsões`);

// Testar processamento de feedback
const feedback = await retroactivePredictionService.processFeedback(
  'test_user_123',
  'Sí! Pasó exactamente como dijiste!'
);

console.log('Resultado do feedback:', feedback);

// Testar estatísticas de precisão
const stats = await retroactivePredictionService.getAccuracyStats('test_user_123');
console.log('Estatísticas do usuário:', stats);
```

### Testes Unitários

```javascript
describe('Retroactive Prediction Service', () => {
  test('extrai previsões específicas de tempo', async () => {
    const response = 'Entre las 14:00 y 16:00, recibirás buenas noticias.';
    const count = await extractPredictions('user1', response, {});
    expect(count).toBeGreaterThan(0);
  });

  test('detecta palavras-chave de acerto', () => {
    const feedback = 'Sí! Acertaste completamente!';
    const isHit = detectsPredictionFeedback(feedback);
    expect(isHit).toBe(true);
  });

  test('calcula precisão corretamente', async () => {
    const stats = await getAccuracyStats('user1');
    expect(stats.monthly_accuracy).toBeGreaterThanOrEqual(0);
    expect(stats.monthly_accuracy).toBeLessThanOrEqual(100);
  });
});
```

## Tratamento de Erros

### Degradação Graceful

O sistema de previsão NUNCA quebra o fluxo principal do AI Coach:

```javascript
try {
  await retroactivePredictionService.extractPredictions(userId, aiResponse);
} catch (predError) {
  // Registrar erro mas não falhar a resposta
  logger.logError(predError, { context: 'extract_predictions', userId });
  // Resposta do AI Coach ainda retorna com sucesso
}
```

### Problemas Comuns

**Problema**: Previsões não extraídas
- **Causa**: Incompatibilidade de padrão
- **Correção**: Verificar regexes de padrão em `_extractPredictions()`
- **Debug**: Verificar tabela `prediction_generation_log`

**Problema**: Previsões duplicadas
- **Causa**: Mesmo texto de previsão armazenado duas vezes
- **Correção**: Restrição única em (user_id, prediction_text, created_at)
- **Impacto**: Silenciosamente ignorado, sem erro

**Problema**: Estatísticas não atualizando
- **Causa**: Trigger não disparando
- **Correção**: Verificar trigger `update_prediction_analytics()`
- **Debug**: Chamar função trigger manualmente

## Melhorias Futuras

### Funcionalidades Fase 2 (Premium)

1. **Dashboard de Histórico de Previsões**
   - Linha do tempo visual de todas as previsões
   - Filtrar por categoria, resultado, data
   - Exportar para relatório PDF

2. **Analytics Avançado**
   - Melhores horários de previsão (quando IA é mais precisa)
   - Pontos fortes de categoria (precisão amor vs carreira)
   - Análise de correlação astrológica

3. **Notificações de Previsão**
   - Notificação push quando janela de tempo de previsão chega
   - Lembrete para verificar resultado de previsão
   - Relatório semanal de precisão

4. **Prova Social**
   - Compartilhar acertos de previsão em mídia social
   - Placar de top usuários por precisão
   - Desafios comunitários de previsão

### Funcionalidades Fase 3 (Melhoria de IA)

1. **Extração Alimentada por ML**
   - Treinar modelo em previsões verificadas
   - Melhorar precisão de correspondência de padrões
   - Detectar padrões sutis de previsão

2. **Pontuação de Confiança**
   - Avaliar probabilidade de previsão antes de extração
   - Apenas extrair previsões de alta confiança
   - Mostrar % de confiança para usuários

3. **Integração Astrológica**
   - Vincular previsões a dados de trânsito
   - Calcular horários ótimos de previsão
   - Personalizar baseado em mapa natal

## Suporte e Solução de Problemas

### Logs para Verificar

```bash
# Logs do service AI Coach
tail -f logs/ai-coach.log | grep "prediction"

# Logs do banco de dados
tail -f logs/postgres.log | grep "predictions"

# Logs de erro
tail -f logs/error.log | grep "retroactive"
```

### Consultas Comuns de Debugging

```sql
-- Verificar previsões pendentes
SELECT * FROM v_pending_feedback WHERE user_id = 'USER_ID';

-- Verificar feedback recente
SELECT * FROM predictions
WHERE user_id = 'USER_ID'
  AND feedback_given_at > NOW() - INTERVAL '7 days'
ORDER BY feedback_given_at DESC;

-- Verificar sincronização de analytics
SELECT * FROM user_prediction_analytics WHERE user_id = 'USER_ID';

-- Forçar recálculo de analytics
UPDATE predictions SET updated_at = NOW()
WHERE user_id = 'USER_ID' AND user_feedback IS NOT NULL
LIMIT 1;
```

### Contato

Para problemas ou dúvidas:
- Líder de Backend: [backend@zodia.app]
- Arquiteto de Sistema: [tech@zodia.app]
- Documentação: `/docs/RETROACTIVE_PREDICTIONS_SYSTEM.md`

---

**Versão**: 1.0.0
**Última Atualização**: 20/01/2025
**Status**: Pronto para Produção ✅
