# 🔥 Sistema de Sequência Diária - Documentação Completa

**Criado:** 23 de janeiro de 2025
**Versão:** 1.0.0
**Impacto Esperado:** +800% de retenção de usuários através de FOMO e formação de hábitos

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Schema do Banco de Dados](#schema-do-banco-de-dados)
4. [Integração de API](#integração-de-api)
5. [Sistema de Marcos](#sistema-de-marcos)
6. [Exemplos de Uso](#exemplos-de-uso)
7. [Guia de Integração Frontend](#guia-de-integração-frontend)
8. [Checklist de Testes](#checklist-de-testes)
9. [Instruções de Deploy](#instruções-de-deploy)

---

## 🎯 Visão Geral

O Sistema de Sequência Diária é uma funcionalidade de gamificação projetada para aumentar a retenção de usuários através de:

- **Check-ins diários**: Rastreamento automático quando usuários interagem com o AI Coach
- **Rastreamento de sequências**: Sequência atual e recorde pessoal (sequência mais longa)
- **Recompensas de marcos**: Recompensas progressivas em números-chave de sequência (3, 7, 14, 30, 60, 90, 180, 365 dias)
- **Pontos cósmicos**: Sistema de acumulação de pontos (+10 por dia + bônus nos marcos)
- **Sistema de badges**: Badges de conquista para marcos importantes
- **Mecânicas de FOMO**: Medo de perder a sequência encoraja retornos diários

### Métricas-Chave

- **Frequência de check-in**: Diária
- **Cálculo de sequência**: Dias consecutivos (quebra se usuário perder um dia)
- **Pontos por check-in**: 10 pontos cósmicos
- **Total de marcos**: 8 marcos principais
- **Idiomas suportados**: Espanhol (es), Inglês (en)

---

## 🏗️ Arquitetura

### Componentes

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Flutter)                    │
│  - Exibir sequência na UI                               │
│  - Mostrar conquistas de marcos                         │
│  - Componente de placar                                 │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Backend - aiCoachService.js                │
│  - Chama streakService.checkIn() em cada mensagem       │
│  - Retorna informações de sequência na resposta         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              streakService.js (Novo Arquivo)            │
│  - checkIn(userId, language)                            │
│  - getStreak(userId)                                    │
│  - getLeaderboard(limit)                                │
│  - Lógica de cálculo de marcos                          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│          PostgreSQL - tabela user_streaks               │
│  - Armazena todos os dados de sequência                 │
│  - Indexado para performance                            │
└─────────────────────────────────────────────────────────┘
```

### Estrutura de Arquivos

```
backend/flutter-horoscope-backend/
├── migrations/
│   └── 011_create_user_streaks_table.sql  [NOVO ✨]
├── src/
│   ├── services/
│   │   ├── streakService.js               [NOVO ✨]
│   │   └── aiCoachService.js              [MODIFICADO]
│   └── config/
│       └── db.js
└── STREAK_SYSTEM_DOCUMENTATION.md          [NOVO ✨]
```

---

## 💾 Schema do Banco de Dados

### Tabela: `user_streaks`

```sql
CREATE TABLE user_streaks (
  -- Identificação primária
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Rastreamento de sequência
  current_streak INT DEFAULT 0 NOT NULL,      -- Dias consecutivos atuais
  longest_streak INT DEFAULT 0 NOT NULL,      -- Recorde pessoal
  last_check_in DATE,                         -- Data do último check-in (UTC)
  total_check_ins INT DEFAULT 0 NOT NULL,     -- Total vitalício

  -- Gamificação
  cosmic_points INT DEFAULT 0 NOT NULL,       -- Pontos acumulados
  badges JSONB DEFAULT '[]'::jsonb NOT NULL,  -- Array de badges conquistados
  milestones_achieved JSONB DEFAULT '[]'::jsonb NOT NULL,  -- Números de marcos alcançados

  -- Metadados
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Índices

```sql
CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX idx_user_streaks_last_check_in ON user_streaks(last_check_in DESC);
CREATE INDEX idx_user_streaks_cosmic_points ON user_streaks(cosmic_points DESC);
```

### Trigger de Auto-atualização

```sql
CREATE TRIGGER trigger_update_user_streaks_timestamp
BEFORE UPDATE ON user_streaks
FOR EACH ROW
EXECUTE FUNCTION update_user_streaks_updated_at();
```

---

## 🔌 Integração de API

### Integração Automática (AI Coach)

O sistema de sequência é **acionado automaticamente** quando usuários enviam mensagens ao AI Coach. Nenhuma chamada de API adicional necessária!

**Modificado em `aiCoachService.js`:**

```javascript
// Linhas 32 (import)
const streakService = require('./streakService');

// Linhas 365-368 (lógica de check-in)
const userLanguage = options.language || 'es';
const streakInfo = await streakService.checkIn(userId, userLanguage);

// Linha 396 (retornar sequência na resposta)
streak: streakInfo
```

### Formato da Resposta

Cada mensagem do AI Coach agora inclui dados de sequência:

```json
{
  "success": true,
  "response": {
    "content": "Your AI coach response...",
    "sessionId": "uuid",
    "messageId": "uuid",
    // ... outros campos
  },
  "usage": {
    "remainingMessages": 10,
    "resetTime": "2025-01-24T00:00:00Z"
  },
  "streak": {
    "success": true,
    "current_streak": 7,
    "longest_streak": 7,
    "is_new_record": true,
    "already_checked_in": false,
    "streak_broken": false,
    "cosmic_points_earned": 80,      // 10 + 70 bônus (marco)
    "total_cosmic_points": 150,
    "total_check_ins": 7,
    "milestone": {
      "streak": 7,
      "name": "Guerreiro de uma Semana",
      "badge": "week_warrior",
      "reward": "Leitura especial da Lua (grátis)",
      "cosmicPoints": 70
    },
    "badges": ["beginner", "week_warrior"],
    "message": "🔥 Sequência atual: 7 dias\n🏆 NOVO RECORDE PESSOAL!\n\n✨ MARCO DESBLOQUEADO: Guerreiro de uma Semana!\n🎁 Recompensa: Leitura especial da Lua (grátis)\n💎 +70 pontos cósmicos extras\n\n💪 Próximo objetivo: 7 dias para \"Dedicado\"\n🎯 Recompensa: 1 consulta premium grátis"
  }
}
```

### Endpoints de API Manual (Opcional)

Você pode adicionar estas rotas para expor funcionalidade de sequência diretamente:

```javascript
// No arquivo de rotas (ex: routes/streak.js)
const express = require('express');
const router = express.Router();
const streakService = require('../services/streakService');

// GET sequência atual do usuário
router.get('/streak/:userId', async (req, res) => {
  const streak = await streakService.getStreak(req.params.userId);
  res.json(streak);
});

// POST check-in manual (se necessário fora do AI Coach)
router.post('/streak/:userId/checkin', async (req, res) => {
  const language = req.body.language || 'es';
  const result = await streakService.checkIn(req.params.userId, language);
  res.json(result);
});

// GET placar
router.get('/streak/leaderboard', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const leaderboard = await streakService.getLeaderboard(limit);
  res.json(leaderboard);
});

module.exports = router;
```

---

## 🏆 Sistema de Marcos

### Tabela Completa de Marcos

| Dias de Sequência | Nome em Português | Nome em Inglês | Badge | Recompensa | Pontos Bônus |
|-------------|-------------|--------------|-------|--------|--------------|
| **3** | Começando | Getting Started | `beginner` | Badge: Começando | +30 |
| **7** | Guerreiro de uma Semana | Week Warrior | `week_warrior` | Leitura especial da Lua (grátis) | +70 |
| **14** | Dedicado | Dedicated | `dedicated` | 1 consulta premium grátis | +150 |
| **30** | Guerreiro Cósmico | Cosmic Warrior | `cosmic_warrior` | Leitura anual 2026 | +300 |
| **60** | Mestre dos Hábitos | Habit Master | `habit_master` | 3 consultas premium grátis | +600 |
| **90** | Iluminado | Enlightened | `enlightened` | 1 mês premium grátis | +1000 |
| **180** | Devoto Cósmico | Cosmic Devotee | `cosmic_devotee` | 3 meses premium grátis | +2000 |
| **365** | Lenda Cósmica | Cosmic Legend | `cosmic_legend` | Premium vitalício | +5000 |

### Lógica de Marcos

1. **Recompensas únicas**: Marcos só podem ser alcançados uma vez por usuário
2. **Rastreados no banco de dados**: Array JSONB `milestones_achieved` armazena números de marcos alcançados
3. **Desbloqueio de badge**: Badges adicionados ao array `badges` ao alcançar marco
4. **Pontos bônus**: Pontos cósmicos extras concedidos além dos +10 diários

### Exemplos de Cálculo de Pontos

```javascript
// Dia 1: Primeiro check-in
cosmic_points_earned = 10
total_cosmic_points = 10

// Dia 3: Marco "Começando"
cosmic_points_earned = 10 + 30 = 40
total_cosmic_points = 10 + 10 + 40 = 60

// Dia 7: Marco "Guerreiro de uma Semana"
cosmic_points_earned = 10 + 70 = 80
total_cosmic_points = 60 + 10 + 10 + 10 + 80 = 170

// Dia 8: Dia regular (já recebeu marco do dia 7)
cosmic_points_earned = 10
total_cosmic_points = 170 + 10 = 180
```

---

## 📱 Exemplos de Uso

### Exemplo 1: Usuário de Primeira Vez

**Requisição:**
```javascript
// Usuário envia primeira mensagem ao AI Coach
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "¿Qué me dice mi horóscopo hoy?",
  "language": "es"
}
```

**Resposta:**
```json
{
  "success": true,
  "response": { /* Resposta da IA */ },
  "streak": {
    "success": true,
    "current_streak": 1,
    "longest_streak": 1,
    "is_new_record": true,
    "is_first_time": true,
    "cosmic_points_earned": 10,
    "total_cosmic_points": 10,
    "total_check_ins": 1,
    "milestone": null,
    "message": "🔥 Primeira sequência! Volte amanhã para mantê-la viva.\n💫 +10 pontos cósmicos ganhos"
  }
}
```

### Exemplo 2: Alcançando Marco de 7 Dias

**Requisição:**
```javascript
// 7º dia consecutivo do usuário
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "Good morning, what's my horoscope?",
  "language": "en"
}
```

**Resposta:**
```json
{
  "success": true,
  "response": { /* Resposta da IA */ },
  "streak": {
    "success": true,
    "current_streak": 7,
    "longest_streak": 7,
    "is_new_record": true,
    "cosmic_points_earned": 80,      // 10 + 70 bônus
    "total_cosmic_points": 150,
    "total_check_ins": 7,
    "milestone": {
      "streak": 7,
      "name": "Week Warrior",
      "badge": "week_warrior",
      "reward": "Free Moon Reading",
      "cosmicPoints": 70
    },
    "badges": ["beginner", "week_warrior"],
    "message": "🔥 Current streak: 7 days\n🏆 NEW PERSONAL RECORD!\n\n✨ MILESTONE UNLOCKED: Week Warrior!\n🎁 Reward: Free Moon Reading\n💎 +70 bonus cosmic points\n\n💪 Next goal: 7 days to \"Dedicated\"\n🎯 Reward: 1 Free Premium Reading"
  }
}
```

### Exemplo 3: Já Fez Check-in Hoje

**Requisição:**
```javascript
// Usuário envia segunda mensagem no mesmo dia
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "Another question...",
  "language": "es"
}
```

**Resposta:**
```json
{
  "success": true,
  "response": { /* Resposta da IA */ },
  "streak": {
    "success": true,
    "current_streak": 7,
    "longest_streak": 7,
    "already_checked_in": true,
    "cosmic_points_earned": 0,       // Sem pontos para check-in duplicado
    "total_cosmic_points": 150,
    "total_check_ins": 7,
    "milestone": null,
    "message": "🔥 Você já se registrou hoje. Sequência atual: 7 dias"
  }
}
```

### Exemplo 4: Sequência Quebrada

**Requisição:**
```javascript
// Usuário retorna depois de perder 2+ dias
POST /ai-coach/sessions/{sessionId}/messages
{
  "message": "I'm back!",
  "language": "en"
}
```

**Resposta:**
```json
{
  "success": true,
  "response": { /* Resposta da IA */ },
  "streak": {
    "success": true,
    "current_streak": 1,              // Resetado para 1
    "longest_streak": 7,              // Recorde pessoal preservado
    "is_new_record": false,
    "streak_broken": true,
    "previous_streak": 7,
    "cosmic_points_earned": 10,
    "total_cosmic_points": 160,       // Continua acumulando
    "total_check_ins": 8,
    "milestone": null,
    "message": "💔 Your streak was broken, but every day is a fresh start.\n🔥 Current streak: 1 day\n\n💪 Next goal: 2 days to \"Getting Started\"\n🎯 Reward: Badge: Getting Started"
  }
}
```

---

## 🎨 Guia de Integração Frontend

### Exemplo de Widget Flutter

```dart
// streak_widget.dart
import 'package:flutter/material.dart';

class StreakWidget extends StatelessWidget {
  final Map<String, dynamic> streakData;

  const StreakWidget({Key? key, required this.streakData}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (!streakData['success']) return SizedBox.shrink();

    final currentStreak = streakData['current_streak'] ?? 0;
    final cosmicPoints = streakData['total_cosmic_points'] ?? 0;
    final milestone = streakData['milestone'];
    final alreadyCheckedIn = streakData['already_checked_in'] ?? false;

    return Card(
      margin: EdgeInsets.all(16),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Contador de sequência
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text('🔥', style: TextStyle(fontSize: 24)),
                    SizedBox(width: 8),
                    Text(
                      '$currentStreak dias',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Text('💎', style: TextStyle(fontSize: 20)),
                    SizedBox(width: 4),
                    Text(
                      '$cosmicPoints',
                      style: TextStyle(fontSize: 18, color: Colors.purple),
                    ),
                  ],
                ),
              ],
            ),

            SizedBox(height: 12),

            // Notificação de marco
            if (milestone != null) ...[
              Container(
                padding: EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.purple.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.purple),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '✨ MARCO DESBLOQUEADO!',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.purple,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      milestone['name'],
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 4),
                    Text('🎁 ${milestone['reward']}'),
                  ],
                ),
              ),
            ],

            // Status de check-in
            if (alreadyCheckedIn) ...[
              SizedBox(height: 8),
              Text(
                '✅ Você já se registrou hoje',
                style: TextStyle(color: Colors.green),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
```

---

## ✅ Checklist de Testes

### Migração do Banco de Dados

- [ ] Executar migração: `psql -d seu_db -f migrations/011_create_user_streaks_table.sql`
- [ ] Verificar tabela criada: `\d user_streaks`
- [ ] Verificar índices criados: `\di idx_user_streaks_*`
- [ ] Verificar trigger criado: `\df update_user_streaks_updated_at`
- [ ] Testar restrição: Tentar inserir sequência negativa (deve falhar)

---

## 🚀 Instruções de Deploy

### Passo 1: Executar Migração do Banco de Dados

```bash
# Produção
psql $DATABASE_URL -f migrations/011_create_user_streaks_table.sql

# Desenvolvimento
psql -U seu_usuario -d seu_db -f migrations/011_create_user_streaks_table.sql
```

### Passo 2: Verificar Migração

```sql
-- Verificar que a tabela existe
SELECT COUNT(*) FROM user_streaks;

-- Verificar índices
SELECT indexname FROM pg_indexes WHERE tablename = 'user_streaks';

-- Deve retornar:
-- idx_user_streaks_user_id
-- idx_user_streaks_current_streak
-- idx_user_streaks_last_check_in
-- idx_user_streaks_cosmic_points
```

### Passo 3: Deploy do Código do Backend

```bash
# Garantir que novos arquivos estão commitados
git add migrations/011_create_user_streaks_table.sql
git add src/services/streakService.js
git add STREAK_SYSTEM_DOCUMENTATION.md
git commit -m "feat: implementar sistema de gamificação de sequência diária"

# Deploy para produção
git push heroku main
# OU seu método de deployment
```

---

## 📊 Métricas e KPIs Esperados

### Métricas de Retenção

| Métrica | Antes das Sequências | Alvo Após Sequências | Período de Medição |
|--------|---------------|---------------------|-------------------|
| **Retenção Dia 1** | ~40% | ~70% | 30 dias |
| **Retenção Dia 7** | ~15% | ~45% | 30 dias |
| **Retenção Dia 30** | ~5% | ~25% | 90 dias |
| **Usuários Ativos Diários** | Baseline | +800% | 90 dias |

### Métricas de Engajamento

- **Frequência média de sessão**: Alvo 5x/semana (acima de 1-2x/semana)
- **Taxa de conclusão de sequência (7 dias)**: Alvo 30% dos usuários
- **Taxa de conclusão de sequência (30 dias)**: Alvo 10% dos usuários
- **Taxa de conquista de marcos**: Rastrear % de usuários alcançando cada marco

### Impacto na Receita

- **Conversões premium de sequências**: Rastrear usuários que fazem upgrade após alcançar marcos
- **Aumento de valor vitalício**: Esperar 3-5x LTV para usuários com sequências de 30+ dias

---

## 🔧 Solução de Problemas

### Problema: Sequência não atualizando

**Sintomas:** Usuário faz check-in mas sequência permanece em 0
**Solução:**
```sql
-- Verificar se registro existe
SELECT * FROM user_streaks WHERE user_id = 'uuid';

-- Se não houver registro, o primeiro check-in deve criar um
-- Verificar logs do servidor para erros em streakService.checkIn()
```

### Problema: Marco concedido múltiplas vezes

**Sintomas:** Usuário recebe mesmo marco duas vezes
**Solução:**
```sql
-- Verificar array milestones_achieved
SELECT milestones_achieved FROM user_streaks WHERE user_id = 'uuid';

-- Deve ser: [3, 7, 14, 30] (números aparecem apenas uma vez)
-- Se existirem duplicatas, corrigir dados:
UPDATE user_streaks
SET milestones_achieved = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM jsonb_array_elements_text(milestones_achieved) elem
)
WHERE user_id = 'uuid';
```

---

## 📝 Changelog

### v1.0.0 (23/01/2025)
- ✨ Lançamento inicial
- 🗄️ Schema do banco de dados com tabela user_streaks
- 🔥 Rastreamento central de sequência (atual, mais longa, total)
- 🏆 Sistema de marcos de 8 níveis (3 a 365 dias)
- 💎 Gamificação de pontos cósmicos
- 🎖️ Sistema de badges
- 🌍 Suporte bilíngue (ES/EN)
- 🔗 Auto-integração com AI Coach
- 📊 Funcionalidade de placar

---

## 🆘 Suporte

Para dúvidas ou problemas:
- **Documentação:** Este arquivo
- **Localização do código:** `/src/services/streakService.js`
- **Banco de dados:** Tabela `user_streaks`
- **Logs:** Verificar `loggingService` para erros relacionados a sequências

---

**Construído com 💜 para os usuários da Zodia**
*Transformando orientação cósmica diária em um hábito, uma sequência por vez.*
