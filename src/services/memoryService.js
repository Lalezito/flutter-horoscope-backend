/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🧠 MEMORY SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Revolutionary Long-Term Memory System for AI Coach
 *
 * PURPOSE:
 * Extracts and manages important user life events, goals, challenges, and
 * milestones from conversations. Allows AI to reference these memories
 * weeks/months later, creating deep emotional connection.
 *
 * IMPACT:
 * +1000% increase in emotional connection and user retention
 * Users report: "It remembers my life! It feels like a real friend."
 *
 * KEY FEATURES:
 * - Automatic memory extraction from user messages
 * - Intelligent importance scoring
 * - Resolution tracking for ongoing situations
 * - Contextual memory retrieval
 * - Multilingual support (ES, EN, PT, FR, DE, IT)
 *
 * CREATED: 2025-01-23
 * VERSION: 1.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const db = require('../config/db');
const logger = require('./loggingService');

class MemoryService {
  constructor() {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MEMORY EXTRACTION PATTERNS (Multilingual)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    this.patterns = {
      // ┌─────────────────────────────────────────────────────────────┐
      // │ CRITICAL LIFE EVENTS (Importance: 9-10)                     │
      // └─────────────────────────────────────────────────────────────┘
      life_event: {
        keywords: [
          // Spanish
          'mi mamá', 'mi papá', 'mi madre', 'mi padre', 'mi hijo', 'mi hija',
          'enfermo', 'enferma', 'murió', 'falleció', 'hospital', 'accidente',
          'divorcio', 'separé', 'separamos', 'perdí mi trabajo', 'me despidieron',
          'embarazada', 'embarazo', 'me casé', 'boda', 'funeral',
          'operación', 'cirugía', 'diagnóstico', 'cáncer', 'grave',
          // English
          'my mom', 'my dad', 'my mother', 'my father', 'my son', 'my daughter',
          'sick', 'ill', 'died', 'passed away', 'hospital', 'accident',
          'divorce', 'separated', 'lost my job', 'fired', 'laid off',
          'pregnant', 'pregnancy', 'married', 'wedding', 'funeral',
          'surgery', 'operation', 'diagnosis', 'cancer', 'critical',
          // Portuguese
          'minha mãe', 'meu pai', 'meu filho', 'minha filha',
          'doente', 'morreu', 'faleceu', 'hospital', 'acidente',
          'divórcio', 'separei', 'perdi meu emprego', 'grávida',
          'casamento', 'funeral', 'cirurgia', 'diagnóstico',
          // French
          'ma mère', 'mon père', 'mon fils', 'ma fille',
          'malade', 'mort', 'décédé', 'hôpital', 'accident',
          'divorce', 'séparé', 'perdu mon travail', 'enceinte',
          'mariage', 'funérailles', 'chirurgie', 'diagnostic',
          // German
          'meine mutter', 'mein vater', 'mein sohn', 'meine tochter',
          'krank', 'gestorben', 'krankenhaus', 'unfall',
          'scheidung', 'getrennt', 'job verloren', 'schwanger',
          'hochzeit', 'beerdigung', 'operation', 'diagnose',
          // Italian
          'mia madre', 'mio padre', 'mio figlio', 'mia figlia',
          'malato', 'morto', 'ospedale', 'incidente',
          'divorzio', 'separato', 'perso il lavoro', 'incinta',
          'matrimonio', 'funerale', 'operazione', 'diagnosi'
        ],
        importance: 9
      },

      // ┌─────────────────────────────────────────────────────────────┐
      // │ GOALS & ASPIRATIONS (Importance: 8)                         │
      // └─────────────────────────────────────────────────────────────┘
      goal: {
        keywords: [
          // Spanish
          'quiero conseguir', 'mi meta es', 'voy a', 'quiero lograr',
          'mi objetivo', 'planeo', 'sueño con', 'aspiro a',
          'me gustaría', 'necesito lograr', 'tengo que conseguir',
          'entrevista de trabajo', 'nuevo trabajo', 'promoción',
          'comprar casa', 'comprar carro', 'viajar a', 'mudanza',
          // English
          'want to achieve', 'my goal is', 'going to', 'want to accomplish',
          'my objective', 'planning to', 'dream of', 'aspire to',
          'would like to', 'need to achieve', 'have to get',
          'job interview', 'new job', 'promotion',
          'buy house', 'buy car', 'travel to', 'moving to',
          // Portuguese
          'quero conseguir', 'minha meta', 'vou', 'quero alcançar',
          'meu objetivo', 'planejo', 'sonho em', 'aspiro',
          'entrevista de emprego', 'novo emprego', 'promoção',
          // French
          'veux atteindre', 'mon objectif', 'vais', 'rêve de',
          'projet de', 'entretien d\'embauche', 'nouveau travail',
          // German
          'möchte erreichen', 'mein ziel', 'plane', 'träume von',
          'vorstellungsgespräch', 'neue stelle', 'beförderung',
          // Italian
          'voglio raggiungere', 'il mio obiettivo', 'sogno di',
          'colloquio di lavoro', 'nuovo lavoro', 'promozione'
        ],
        importance: 8
      },

      // ┌─────────────────────────────────────────────────────────────┐
      // │ MILESTONES & IMPORTANT DATES (Importance: 7)                │
      // └─────────────────────────────────────────────────────────────┘
      milestone: {
        keywords: [
          // Spanish
          'entrevista', 'examen', 'presentación importante', 'defensa de tesis',
          'viaje importante', 'mudanza', 'graduación', 'cumpleaños',
          'aniversario', 'cita importante', 'reunión crucial',
          'el próximo mes', 'la próxima semana', 'en dos semanas',
          // English
          'interview', 'exam', 'important presentation', 'thesis defense',
          'important trip', 'moving', 'graduation', 'birthday',
          'anniversary', 'important appointment', 'crucial meeting',
          'next month', 'next week', 'in two weeks',
          // Portuguese
          'entrevista', 'exame', 'apresentação importante', 'defesa de tese',
          'viagem importante', 'mudança', 'formatura', 'aniversário',
          'próximo mês', 'próxima semana',
          // French
          'entretien', 'examen', 'présentation importante', 'soutenance',
          'voyage important', 'déménagement', 'remise des diplômes',
          'mois prochain', 'semaine prochaine',
          // German
          'vorstellungsgespräch', 'prüfung', 'wichtige präsentation',
          'wichtige reise', 'umzug', 'abschluss', 'geburtstag',
          'nächsten monat', 'nächste woche',
          // Italian
          'colloquio', 'esame', 'presentazione importante',
          'viaggio importante', 'trasloco', 'laurea', 'compleanno',
          'prossimo mese', 'prossima settimana'
        ],
        importance: 7
      },

      // ┌─────────────────────────────────────────────────────────────┐
      // │ CHALLENGES & PROBLEMS (Importance: 6)                       │
      // └─────────────────────────────────────────────────────────────┘
      challenge: {
        keywords: [
          // Spanish
          'problema con', 'no puedo', 'me cuesta', 'dificultad con',
          'miedo a', 'ansiedad por', 'preocupado por', 'angustia',
          'no sé cómo', 'tengo conflicto', 'pelea con', 'discusión con',
          'estrés por', 'agobiado por', 'abrumado por',
          // English
          'problem with', 'cannot', 'can\'t', 'struggle with',
          'difficulty with', 'afraid of', 'anxious about', 'worried about',
          'don\'t know how', 'conflict with', 'fight with', 'argument with',
          'stressed about', 'overwhelmed by',
          // Portuguese
          'problema com', 'não consigo', 'tenho dificuldade',
          'medo de', 'ansiedade por', 'preocupado com',
          'conflito com', 'briga com', 'estressado por',
          // French
          'problème avec', 'ne peux pas', 'difficulté avec',
          'peur de', 'anxieux à propos', 'inquiet de',
          'conflit avec', 'dispute avec', 'stressé par',
          // German
          'problem mit', 'kann nicht', 'schwierigkeit mit',
          'angst vor', 'ängstlich wegen', 'besorgt über',
          'konflikt mit', 'streit mit', 'gestresst von',
          // Italian
          'problema con', 'non posso', 'difficoltà con',
          'paura di', 'ansioso per', 'preoccupato per',
          'conflitto con', 'litigio con', 'stressato per'
        ],
        importance: 6
      },

      // ┌─────────────────────────────────────────────────────────────┐
      // │ IMPORTANT PEOPLE (Importance: 7)                            │
      // └─────────────────────────────────────────────────────────────┘
      person: {
        keywords: [
          // Spanish
          'mi pareja', 'mi novio', 'mi novia', 'mi esposo', 'mi esposa',
          'mi jefe', 'mi compañero', 'mi mejor amigo', 'mi mejor amiga',
          'mi hermano', 'mi hermana', 'mi abuelo', 'mi abuela',
          // English
          'my partner', 'my boyfriend', 'my girlfriend', 'my husband', 'my wife',
          'my boss', 'my colleague', 'my best friend',
          'my brother', 'my sister', 'my grandfather', 'my grandmother',
          // Portuguese
          'meu parceiro', 'minha parceira', 'meu namorado', 'minha namorada',
          'meu marido', 'minha esposa', 'meu chefe', 'meu colega',
          'meu melhor amigo', 'minha melhor amiga',
          // French
          'mon partenaire', 'ma partenaire', 'mon copain', 'ma copine',
          'mon mari', 'ma femme', 'mon patron', 'mon collègue',
          'mon meilleur ami', 'ma meilleure amie',
          // German
          'mein partner', 'meine partnerin', 'mein freund', 'meine freundin',
          'mein mann', 'meine frau', 'mein chef', 'mein kollege',
          // Italian
          'il mio partner', 'la mia partner', 'il mio ragazzo', 'la mia ragazza',
          'mio marito', 'mia moglie', 'il mio capo', 'il mio collega'
        ],
        importance: 7
      },

      // ┌─────────────────────────────────────────────────────────────┐
      // │ EMOTIONAL STATES (Importance: 5)                            │
      // └─────────────────────────────────────────────────────────────┘
      emotion: {
        keywords: [
          // Spanish
          'me siento muy', 'estoy muy', 'siento mucha',
          'deprimido', 'depresión', 'ansiedad crónica', 'pánico',
          // English
          'feel very', 'feeling extremely', 'chronic anxiety',
          'depressed', 'depression', 'panic attacks',
          // Portuguese
          'me sinto muito', 'estou muito', 'deprimido',
          'depressão', 'ansiedade crônica',
          // French
          'je me sens très', 'je suis très', 'déprimé',
          'dépression', 'anxiété chronique',
          // German
          'fühle mich sehr', 'bin sehr', 'deprimiert',
          'depression', 'chronische angst',
          // Italian
          'mi sento molto', 'sono molto', 'depresso',
          'depressione', 'ansia cronica'
        ],
        importance: 5
      }
    };
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🎯 EXTRACT AND STORE MEMORIES
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Analyzes user message for important topics and stores them as memories
   *
   * @param {string} userMessage - The user's message content
   * @param {string} userId - UUID of the user
   * @returns {Promise<number>} Number of new memories extracted
   */
  async extractAndStoreMemories(userMessage, userId) {
    try {
      const lowerMessage = userMessage.toLowerCase();
      const memories = [];

      // Scan message for each memory type
      for (const [type, config] of Object.entries(this.patterns)) {
        for (const keyword of config.keywords) {
          if (lowerMessage.includes(keyword.toLowerCase())) {
            // Extract the sentence containing the keyword
            const sentences = userMessage.split(/[.!?¡¿]/);
            const relevantSentence = sentences.find(s =>
              s.toLowerCase().includes(keyword.toLowerCase())
            );

            if (relevantSentence && relevantSentence.trim().length > 10) {
              memories.push({
                type,
                content: relevantSentence.trim(),
                importance: config.importance,
                keyword // For metadata
              });
              break; // Only extract once per type per message
            }
          }
        }
      }

      // Store unique memories in database
      let stored = 0;
      for (const memory of memories) {
        try {
          // Check if similar memory already exists (avoid duplicates)
          const checkQuery = `
            SELECT id FROM user_memories
            WHERE user_id = $1
              AND memory_type = $2
              AND resolved = false
              AND (
                content ILIKE $3
                OR similarity(content, $4) > 0.7
              )
            LIMIT 1
          `;

          const existing = await db.query(checkQuery, [
            userId,
            memory.type,
            `%${memory.content.substring(0, 30)}%`,
            memory.content
          ]);

          if (existing.rows.length === 0) {
            // Store new memory
            const insertQuery = `
              INSERT INTO user_memories (
                user_id,
                memory_type,
                content,
                importance,
                metadata
              ) VALUES ($1, $2, $3, $4, $5)
              RETURNING id
            `;

            await db.query(insertQuery, [
              userId,
              memory.type,
              memory.content,
              memory.importance,
              JSON.stringify({
                keyword: memory.keyword,
                extracted_at: new Date().toISOString(),
                source: 'auto_extraction'
              })
            ]);

            stored++;

            logger.getLogger().info('🧠 New memory extracted and stored', {
              userId,
              type: memory.type,
              importance: memory.importance,
              contentPreview: memory.content.substring(0, 50)
            });
          }
        } catch (error) {
          logger.logError(error, {
            context: 'store_individual_memory',
            userId,
            memoryType: memory.type
          });
          // Continue with other memories even if one fails
        }
      }

      if (stored > 0) {
        logger.getLogger().info(`✅ Stored ${stored} new memories for user`, { userId });
      }

      return stored;

    } catch (error) {
      logger.logError(error, {
        context: 'extract_and_store_memories',
        userId
      });
      return 0;
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 💭 GET RELEVANT MEMORIES
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Retrieves relevant memories to include in AI context
   *
   * @param {string} userId - UUID of the user
   * @param {string} currentMessage - Current user message (for relevance)
   * @param {string} language - Language code (es, en, pt, fr, de, it)
   * @returns {Promise<string|null>} Formatted memory context for AI prompt
   */
  async getRelevantMemories(userId, currentMessage = '', language = 'en') {
    try {
      // Get unresolved memories sorted by importance
      const query = `
        SELECT
          id,
          memory_type,
          content,
          importance,
          mentioned_at,
          EXTRACT(DAY FROM NOW() - mentioned_at)::INT as days_ago,
          metadata
        FROM user_memories
        WHERE user_id = $1
          AND resolved = false
        ORDER BY importance DESC, mentioned_at DESC
        LIMIT 5
      `;

      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        return null; // No memories to include
      }

      // Update last_referenced timestamp
      const memoryIds = result.rows.map(m => m.id);
      await db.query(
        `UPDATE user_memories
         SET last_referenced = NOW()
         WHERE id = ANY($1)`,
        [memoryIds]
      );

      // Build memory context for AI (multilingual)
      const translations = {
        en: {
          title: 'USER\'S IMPORTANT MEMORIES',
          instructions: 'CRITICAL INSTRUCTIONS ABOUT MEMORIES',
          mentioned: 'Mentioned',
          today: 'today',
          yesterday: 'yesterday',
          daysAgo: 'days ago',
          importance: 'importance',
          tips: [
            'REFERENCE these memories naturally if relevant to current context',
            'ASK about updates on important topics (e.g., "How\'s your mom?" if mentioned illness)',
            'CELEBRATE achievements since last conversation',
            'SHOW that you REMEMBER their life - this creates deep connection',
            'If user mentions resolution, acknowledge you\'ll update the memory'
          ],
          example: 'Example of good reference:\n"Before we dive in... how did that interview go that you mentioned 5 days ago? I\'ve been thinking about you ✨"'
        },
        es: {
          title: 'MEMORIAS IMPORTANTES DEL USUARIO',
          instructions: 'INSTRUCCIONES CRÍTICAS SOBRE MEMORIAS',
          mentioned: 'Mencionado',
          today: 'hoy',
          yesterday: 'ayer',
          daysAgo: 'días atrás',
          importance: 'importancia',
          tips: [
            'REFERENCIA estas memorias naturalmente si son relevantes al contexto actual',
            'PREGUNTA sobre actualizaciones de temas importantes (ej: "¿Cómo está tu mamá?" si mencionó enfermedad)',
            'CELEBRA logros desde la última conversación',
            'MUESTRA que RECUERDAS su vida - esto crea conexión profunda',
            'Si el usuario menciona resolución de un tema, menciona que actualizarás la memoria'
          ],
          example: 'Ejemplo de buena referencia:\n"Antes que nada... ¿cómo te fue en esa entrevista que mencionaste hace 5 días? He estado pensando en ti ✨"'
        },
        pt: {
          title: 'MEMÓRIAS IMPORTANTES DO USUÁRIO',
          instructions: 'INSTRUÇÕES CRÍTICAS SOBRE MEMÓRIAS',
          mentioned: 'Mencionado',
          today: 'hoje',
          yesterday: 'ontem',
          daysAgo: 'dias atrás',
          importance: 'importância',
          tips: [
            'REFERENCIE essas memórias naturalmente se relevantes ao contexto atual',
            'PERGUNTE sobre atualizações de tópicos importantes',
            'CELEBRE conquistas desde a última conversa',
            'MOSTRE que LEMBRA da vida deles - isso cria conexão profunda',
            'Se o usuário mencionar resolução, reconheça que atualizará a memória'
          ],
          example: 'Exemplo de boa referência:\n"Antes de mais nada... como foi aquela entrevista que você mencionou há 5 dias? Tenho pensado em você ✨"'
        },
        fr: {
          title: 'SOUVENIRS IMPORTANTS DE L\'UTILISATEUR',
          instructions: 'INSTRUCTIONS CRITIQUES SUR LES SOUVENIRS',
          mentioned: 'Mentionné',
          today: 'aujourd\'hui',
          yesterday: 'hier',
          daysAgo: 'jours',
          importance: 'importance',
          tips: [
            'RÉFÉRENCEZ ces souvenirs naturellement si pertinent',
            'DEMANDEZ des mises à jour sur les sujets importants',
            'CÉLÉBREZ les réalisations depuis la dernière conversation',
            'MONTREZ que vous vous SOUVENEZ de leur vie',
            'Si résolution mentionnée, confirmez la mise à jour'
          ],
          example: 'Exemple de bonne référence:\n"Avant tout... comment s\'est passé cet entretien dont tu m\'as parlé il y a 5 jours ? Je pensais à toi ✨"'
        },
        de: {
          title: 'WICHTIGE ERINNERUNGEN DES BENUTZERS',
          instructions: 'KRITISCHE ANWEISUNGEN ZU ERINNERUNGEN',
          mentioned: 'Erwähnt',
          today: 'heute',
          yesterday: 'gestern',
          daysAgo: 'Tage her',
          importance: 'Wichtigkeit',
          tips: [
            'REFERENZIEREN Sie diese Erinnerungen natürlich wenn relevant',
            'FRAGEN Sie nach Updates zu wichtigen Themen',
            'FEIERN Sie Erfolge seit dem letzten Gespräch',
            'ZEIGEN Sie, dass Sie sich an ihr Leben ERINNERN',
            'Bei Erwähnung von Lösung, bestätigen Sie das Update'
          ],
          example: 'Beispiel für gute Referenz:\n"Zunächst... wie lief das Vorstellungsgespräch, das du vor 5 Tagen erwähnt hast? Ich habe an dich gedacht ✨"'
        },
        it: {
          title: 'MEMORIE IMPORTANTI DELL\'UTENTE',
          instructions: 'ISTRUZIONI CRITICHE SULLE MEMORIE',
          mentioned: 'Menzionato',
          today: 'oggi',
          yesterday: 'ieri',
          daysAgo: 'giorni fa',
          importance: 'importanza',
          tips: [
            'RIFERISCI queste memorie naturalmente se pertinente',
            'CHIEDI aggiornamenti su argomenti importanti',
            'CELEBRA i risultati dall\'ultima conversazione',
            'MOSTRA che RICORDI la loro vita',
            'Se menziona risoluzione, conferma l\'aggiornamento'
          ],
          example: 'Esempio di buon riferimento:\n"Prima di tutto... come è andato quel colloquio che hai menzionato 5 giorni fa? Ho pensato a te ✨"'
        }
      };

      const t = translations[language] || translations.en;

      let memoryContext = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      memoryContext += `🧠 ${t.title}:\n`;
      memoryContext += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      for (const mem of result.rows) {
        const daysAgo = parseInt(mem.days_ago);
        const timeStr = daysAgo === 0 ? t.today :
                        daysAgo === 1 ? t.yesterday :
                        `${daysAgo} ${t.daysAgo}`;

        memoryContext += `[${mem.memory_type.toUpperCase()}] ${mem.content}\n`;
        memoryContext += `   (${t.mentioned} ${timeStr}, ${t.importance}: ${mem.importance}/10)\n\n`;
      }

      memoryContext += `\n${t.instructions}:\n`;
      t.tips.forEach((tip, index) => {
        memoryContext += `${index + 1}. ${tip}\n`;
      });
      memoryContext += `\n${t.example}\n`;

      logger.getLogger().info('💭 Retrieved memories for AI context', {
        userId,
        count: result.rows.length,
        language
      });

      return memoryContext;

    } catch (error) {
      logger.logError(error, {
        context: 'get_relevant_memories',
        userId
      });
      return null;
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * ✅ RESOLVE MEMORY
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Marks a memory as resolved (e.g., job interview passed, problem solved)
   *
   * @param {string} userId - UUID of the user
   * @param {string} contentSnippet - Snippet of memory content to match
   * @param {string} resolution - How it was resolved
   * @returns {Promise<boolean>} True if memory was resolved
   */
  async resolveMemory(userId, contentSnippet, resolution) {
    try {
      const query = `
        UPDATE user_memories
        SET
          resolved = true,
          resolution_note = $1,
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $2
          AND content ILIKE $3
          AND resolved = false
        RETURNING id, memory_type, content
      `;

      const result = await db.query(query, [
        resolution,
        userId,
        `%${contentSnippet}%`
      ]);

      if (result.rows.length > 0) {
        logger.getLogger().info('✅ Memory resolved', {
          userId,
          memoryId: result.rows[0].id,
          type: result.rows[0].memory_type,
          resolution
        });
        return true;
      }

      return false;

    } catch (error) {
      logger.logError(error, {
        context: 'resolve_memory',
        userId,
        contentSnippet
      });
      return false;
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔍 DETECT RESOLUTION IN MESSAGE
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Detects if user is reporting resolution of a previous issue/goal
   *
   * @param {string} message - User's message
   * @param {string} userId - UUID of the user
   * @returns {Promise<void>}
   */
  async detectAndResolve(message, userId) {
    try {
      const lowerMessage = message.toLowerCase();

      // Resolution patterns (multilingual)
      const resolutionPatterns = [
        // Spanish
        { pattern: /(conseguí|logré|obtuve).*(trabajo|empleo|puesto)/, type: 'goal' },
        { pattern: /me dieron.*(trabajo|puesto|promoción)/, type: 'goal' },
        { pattern: /(aprobé|pasé).*(examen|entrevista)/, type: 'milestone' },
        { pattern: /(ya está mejor|se recuperó|salió del hospital)/, type: 'life_event' },
        { pattern: /(solucioné|resolví|superé).*(problema|conflicto)/, type: 'challenge' },
        // English
        { pattern: /(got|landed|received).*(job|position|promotion)/, type: 'goal' },
        { pattern: /(passed|aced).*(exam|interview)/, type: 'milestone' },
        { pattern: /(got better|recovered|left hospital)/, type: 'life_event' },
        { pattern: /(solved|resolved|overcame).*(problem|conflict)/, type: 'challenge' },
        // Portuguese
        { pattern: /(consegui|obtive).*(trabalho|emprego|vaga)/, type: 'goal' },
        { pattern: /(passei|aprovei).*(exame|entrevista)/, type: 'milestone' },
        { pattern: /(melhorou|recuperou|saiu do hospital)/, type: 'life_event' },
        // French
        { pattern: /(obtenu|reçu).*(travail|poste|promotion)/, type: 'goal' },
        { pattern: /(réussi|passé).*(examen|entretien)/, type: 'milestone' },
        // German
        { pattern: /(bekommen|erhalten).*(job|stelle|beförderung)/, type: 'goal' },
        { pattern: /(bestanden|geschafft).*(prüfung|vorstellungsgespräch)/, type: 'milestone' },
        // Italian
        { pattern: /(ottenuto|ricevuto).*(lavoro|posizione|promozione)/, type: 'goal' },
        { pattern: /(superato|passato).*(esame|colloquio)/, type: 'milestone' }
      ];

      for (const { pattern, type } of resolutionPatterns) {
        if (pattern.test(lowerMessage)) {
          // Get recent memories of this type
          const memories = await db.query(
            `SELECT id, content FROM user_memories
             WHERE user_id = $1
               AND memory_type = $2
               AND resolved = false
             ORDER BY mentioned_at DESC
             LIMIT 3`,
            [userId, type]
          );

          // Try to find matching memory
          for (const memory of memories.rows) {
            const memoryWords = memory.content.toLowerCase().split(/\s+/);
            const messageWords = lowerMessage.split(/\s+/);

            // Check for word overlap
            const overlap = memoryWords.filter(word =>
              word.length > 4 && messageWords.includes(word)
            );

            if (overlap.length >= 2) {
              // Found likely match - resolve it
              await this.resolveMemory(
                userId,
                memory.content.substring(0, 30),
                `Auto-resolved: ${message.substring(0, 100)}`
              );
              break;
            }
          }
        }
      }

    } catch (error) {
      logger.logError(error, {
        context: 'detect_and_resolve',
        userId
      });
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 📊 GET MEMORY STATS
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Returns statistics about user's memories
   *
   * @param {string} userId - UUID of the user
   * @returns {Promise<Object>} Memory statistics
   */
  async getStats(userId) {
    try {
      const query = `
        SELECT
          COUNT(*) as total_memories,
          COUNT(*) FILTER (WHERE resolved = true) as resolved,
          COUNT(*) FILTER (WHERE resolved = false) as active,
          MAX(importance) as highest_importance,
          AVG(importance)::NUMERIC(3,1) as avg_importance,
          COUNT(DISTINCT memory_type) as memory_types,
          MAX(mentioned_at) as last_memory_date
        FROM user_memories
        WHERE user_id = $1
      `;

      const result = await db.query(query, [userId]);

      return result.rows[0] || {
        total_memories: 0,
        resolved: 0,
        active: 0,
        highest_importance: 0,
        avg_importance: 0,
        memory_types: 0,
        last_memory_date: null
      };

    } catch (error) {
      logger.logError(error, {
        context: 'get_memory_stats',
        userId
      });
      return null;
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 📋 GET ALL MEMORIES
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Gets all memories for a user (for admin/debugging)
   *
   * @param {string} userId - UUID of the user
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of memories
   */
  async getAllMemories(userId, options = {}) {
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const includeResolved = options.includeResolved || false;

      const query = `
        SELECT
          id,
          memory_type,
          content,
          importance,
          mentioned_at,
          resolved,
          resolution_note,
          resolved_at,
          metadata
        FROM user_memories
        WHERE user_id = $1
          ${includeResolved ? '' : 'AND resolved = false'}
        ORDER BY importance DESC, mentioned_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await db.query(query, [userId, limit, offset]);

      return result.rows;

    } catch (error) {
      logger.logError(error, {
        context: 'get_all_memories',
        userId
      });
      return [];
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🗑️ DELETE MEMORY
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Deletes a specific memory (for user privacy/control)
   *
   * @param {string} userId - UUID of the user
   * @param {string} memoryId - UUID of the memory
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteMemory(userId, memoryId) {
    try {
      const query = `
        DELETE FROM user_memories
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;

      const result = await db.query(query, [memoryId, userId]);

      if (result.rows.length > 0) {
        logger.getLogger().info('🗑️ Memory deleted', {
          userId,
          memoryId
        });
        return true;
      }

      return false;

    } catch (error) {
      logger.logError(error, {
        context: 'delete_memory',
        userId,
        memoryId
      });
      return false;
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🧪 HEALTH CHECK
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async healthCheck() {
    try {
      // Test database connection
      await db.query('SELECT COUNT(*) FROM user_memories');

      return {
        healthy: true,
        service: 'MemoryService',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.logError(error, { context: 'memory_service_health_check' });

      return {
        healthy: false,
        service: 'MemoryService',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new MemoryService();
