// =========================================================
// Jornada Sebrae — protótipo jogável
//
// COMO PERSONALIZAR:
//  - Cores da marca: editar THEME (abaixo) + :root em style.css (manter os dois sincronizados)
//  - Personagens jogáveis: editar CHARACTERS (abaixo) + arquivos em assets/characters/<id>/
//  - Fases, murais e perguntas: editar PHASES
//  - Textos "Sobre o escritório" / "Sobre o criador": editar diretamente no index.html
// =========================================================

const RANKING_KEY = "jornada_sebrae_finecap_v1";
const MAX_LIVES = 6;
const INFO_PROXIMITY_RADIUS = 90; // px — raio em que o mural fica visível
const ANSWER_SECONDS = 15; // tempo pra responder depois que as alternativas aparecem
const ONCE_BUBBLE_MIN_MS = 4500; // tempo mínimo que um mural "de uso único" fica aberto, mesmo andando
const NARRATIVE_TYPE_SPEED_MS = 45;
const NARRATIVE_DEFAULT_DURATION_MS = 4000;
// ---------------------------------------------------------
// TEMA / IDENTIDADE VISUAL (deve bater com :root em style.css)
// ---------------------------------------------------------
const THEME = {
  primary: 0x14213d, // azul-marinho
  primaryDark: 0x0b1526,
  accent: 0xf2a900, // dourado
  accentLight: 0xffe27a,
  cream: 0xf5f0e6,
  danger: 0xc0392b,
  success: 0x2e7d32,
  skin: 0xe8b892,
  hair: 0x2b1d12,
  shoe: 0x111111,
};

// ---------------------------------------------------------
// ÁUDIO
// ---------------------------------------------------------
const SFX = {
  bgm: new Audio("assets/audio/bgm.mp3"),
  type: new Audio("assets/audio/type_blip.wav"),
  tick: new Audio("assets/audio/countdown_tick.wav"),
  locked: new Audio("assets/audio/locked.mp3"),
  unlock: new Audio("assets/audio/unlock.mp3"),
  complete: new Audio("assets/audio/completed.wav"),
};
SFX.bgm.loop = true;
SFX.bgm.volume = 0.2;
SFX.type.volume = 0.03;
SFX.tick.volume = 1.0;
SFX.tick.loop = false;
SFX.locked.volume = 0.6;
SFX.unlock.volume = 0.8;
SFX.complete.volume = 0.8;

function playSfx(audio) {
  try {
    audio.currentTime = 0;
    audio.play();
  } catch (e) {
    /* ignora erro de autoplay */
  }
}

function stopSfx(audio) {
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (e) {
    /* ignora erro */
  }
}
function startBgm() {
  SFX.bgm.play().catch(() => {}); // navegadores só liberam áudio após interação do usuário
}

// ---------------------------------------------------------
// PERSONAGENS JOGÁVEIS
// Para adicionar um novo (ex: uma variação mulher), basta:
//  1. Colocar Idle.png e Walk.png em assets/characters/<id>/
//  2. Colocar uma miniatura em assets/thumbnails/<id>.png
//  3. Adicionar uma entrada aqui + um botão em index.html (#character-select)
// ---------------------------------------------------------
const CHARACTERS = [
  { id: "city_men_1", label: "Personagem 1", idleFrames: 6, walkFrames: 10 },
  { id: "city_girl_1", label: "Personagem 2", idleFrames: 6, walkFrames: 10 },
  { id: "city_men_3", label: "Personagem 3", idleFrames: 6, walkFrames: 10 },
];
const CHARACTER_FRAME_SIZE = 128;
// Hitbox real do personagem dentro do frame 128x128 (o resto é espaço transparente)
const CHARACTER_BODY = { width: 44, height: 70, offsetX: 42, offsetY: 58 };
const CHARACTER_SCALE = 2.7; // aumenta/diminui o tamanho do personagem em tela

// ---------------------------------------------------------
// ESTADO GLOBAL DO JOGO (sobrevive entre trocas de fase/cena)
// ---------------------------------------------------------
const GameData = {
  playerName: "Empresário",
  selectedCharacter: CHARACTERS[0].id,
  lives: MAX_LIVES,
  score: 0,
  phaseIndex: 0,
  infosSeen: new Set(), // apenas estatística/curiosidade — NÃO pontua
  correctAnswers: 0,
  startTime: null,
  paused: false, // true SOMENTE durante a batalha do boss
  sessionId: 0, // incrementado a cada nova partida — invalida timers/callbacks antigos
  hasEnded: false, // trava para impedir salvar o ranking duas vezes na mesma partida
};

function resetGameData() {
  GameData.lives = MAX_LIVES;
  GameData.score = 0;
  GameData.phaseIndex = 0;
  GameData.infosSeen = new Set();
  GameData.correctAnswers = 0;
  GameData.startTime = Date.now();
  GameData.paused = false;
  GameData.sessionId += 1;
  GameData.hasEnded = false;
  GameData.lastPhaseIndex = 0;
}

// ---------------------------------------------------------
// CONTEÚDO DAS FASES
// ---------------------------------------------------------
const PHASES = [
  {
    id: "fase1",
    name: "Boas Vindas",
    startX: 80,
    startDirection: "right",
    hasBoss: true,
    exitInitiallyOpen: false,
    phaseNumber: 1,
    phaseLabel: "Fase Boas Vindas",
    skyColor: 0x18233d,
    groundColor: 0x2c3350,
    decorColor: 0x22304f,
    levelWidth: 1990,
    bg: "street_bg.jpg",
    bossX: 1750,
    bossY: 510,
    doorX: 1770,
    groundY: 500,
    showExitArrow: false,
    exitDirection: "forward", // seta aponta pra frente
    characterScale: 2.0,
    infoSpots: [
      {
        x: 350,
        y: 325,
        text: "O Sebrae atua há 53 anos no RN focando na gestão, inovação e no apoio a pequenos negócios com soluções como o EMPRETEC.",
      },
      {
        x: 845,
        y: 330,
        text: "FINECAP significa Feira Intermunicipal de Educação, Cultura, Turismo e Negócios do Alto Oeste Potiguar.",
      },
      {
        x: 1250,
        y: 330,
        text: "Reconhecida como Patrimônio Cultural Imaterial, a FINECAP chega à sua 29ª edição em 2026, com sua tradicional Feira de Negócios!",
      },
    ],
    boss: {
      name: "Analista do Sebrae",
      portrait: {
        idle: "boss1_idle.png",
        talk: "boss1_talk.png",
        blink: "boss1_blink.png",
      },
      portraitHeight: 180,
      dialogueBottom: 195,
      greeting:
        "Olá! Sou Ralph Juliano, Analista do Sebrae. Antes de você seguir sua jornada, vamos ver o que você já sabe sobre o Sebrae e a FINECAP!",
      introLines: [
        "Vamos lá, primeira pergunta:",
        "Show de bola! Próxima:",
        "Última pergunta, capricha:",
      ],
      correctLines: [
        "Isso aí! Você manda bem.",
        "Perfeito, é exatamente isso!",
        "Excelente! Já sei que você vai longe.",
      ],
      wrongLines: [
        "Ops, não foi dessa vez.",
        "Quase! Deixa eu te explicar:",
        "Essa pega muita gente, mas vamos entender:",
      ],
      resultMessages: {
        3: "Mandou muito bem, acertou todas! Pode seguir em frente com confiança.",
        2: "Muito bom! Só um detalhezinho pra revisar, mas já está no caminho certo.",
        1: "Você começou bem, mas vale revisar esses conceitos com calma.",
        0: "Não foi dessa vez, mas o importante é continuar aprendendo. Vamos em frente!",
      },
      questions: [
        // --- PERGUNTAS SOBRE O SEBRAE ---
        {
          q: "O Sebrae atua principalmente no apoio a:",
          options: [
            "Apenas grandes empresas",
            "Pequenos negócios e empreendedores",
            "Apenas órgãos públicos",
            "Somente indústrias",
          ],
          correct: 1,
          explanation:
            "O foco principal do Sebrae é apoiar, capacitar e fortalecer os micro e pequenos negócios e os empreendedores locais.",
        },
        {
          q: "A sigla Sebrae significa:",
          options: [
            "Serviço Brasileiro de Apoio às Micro e Pequenas Empresas",
            "Sistema Brasileiro de Administração Empresarial",
            "Serviço Brasileiro de Apoio ao Emprego",
            "Sistema Brasileiro de Empreendedorismo",
          ],
          correct: 0,
          explanation:
            "Sebrae significa Serviço Brasileiro de Apoio às Micro e Pequenas Empresas, sendo a principal instituição de fomento ao empreendedorismo do país.",
        },
        {
          q: "Qual destes temas faz parte da atuação do Sebrae?",
          options: [
            "Gestão e inovação",
            "Fiscalização de trânsito",
            "Segurança pública",
            "Emissão de passaporte",
          ],
          correct: 0,
          explanation:
            "O Sebrae atua diretamente capacitando empresas e empreendedores em áreas vitais como gestão, inovação, finanças e marketing.",
        },
        {
          q: "Há quantos anos o Sebrae atua no Rio Grande do Norte?",
          options: ["43 anos", "48 anos", "53 anos", "60 anos"],
          correct: 2,
          explanation:
            "O Sebrae atua há 53 anos no Rio Grande do Norte, transformando a realidade de pequenos negócios em todo o estado.",
        },
        {
          q: "Qual destas é uma solução do Sebrae?",
          options: ["EMPRETEC", "FGTS", "PIX", "IPTU"],
          correct: 0,
          explanation:
            "O EMPRETEC é um dos principais e mais conceituados seminários de desenvolvimento do comportamento empreendedor oferecidos pelo Sebrae.",
        },

        // --- PERGUNTAS SOBRE A FINECAP ---
        {
          q: "A FINECAP 2026 chega a qual edição?",
          options: ["25ª", "27ª", "29ª", "30ª"],
          correct: 2,
          explanation:
            "Em 2026, a FINECAP celebra a sua grandiosa 29ª edição, consolidando-se como um dos maiores eventos da região.",
        },
        {
          q: "O que significa a sigla FINECAP?",
          options: [
            "Feira Internacional de Negócios de Pau dos Ferros",
            "Feira Intermunicipal de Educação, Cultura, Turismo e Negócios do Alto Oeste Potiguar",
            "Festival de Negócios e Cultura do Alto Oeste Potiguar",
            "Feira de Indústria e Comércio de Pau dos Ferros",
          ],
          correct: 1,
          explanation:
            "A sigla carrega a essência multissetorial do evento: Feira Intermunicipal de Educação, Cultura, Turismo e Negócios do Alto Oeste Potiguar.",
        },
        {
          q: "Qual atividade também faz parte da programação tradicional da FINECAP, além dos grandes shows?",
          options: [
            "Feira de Negócios",
            "Campeonato estadual de futebol",
            "Festival de cinema",
            "Corrida automobilística",
          ],
          correct: 0,
          explanation:
            "Além dos shows que atraem multidões, a Feira de Negócios é o coração do evento, movimentando a economia e o empreendedorismo.",
        },
        {
          q: "A FINECAP foi reconhecida oficialmente em Pau dos Ferros como:",
          options: [
            "Patrimônio Cultural Imaterial",
            "Patrimônio Histórico Nacional",
            "Patrimônio Natural do Semiárido",
            "Patrimônio Turístico Federal",
          ],
          correct: 0,
          explanation:
            "Pela sua extrema importância histórica, cultural e econômica para a região, a FINECAP foi reconhecida como Patrimônio Cultural Imaterial do município.",
        },
        {
          q: "Além dos shows, a FINECAP também reúne:",
          options: [
            "Negócios, cultura, turismo e educação",
            "Apenas competições esportivas",
            "Apenas gastronomia",
            "Somente apresentações musicais",
          ],
          correct: 0,
          explanation:
            "O evento é amplo e dinâmico, englobando simultaneamente negócios, cultura, turismo e educação no Alto Oeste Potiguar.",
        },
      ],
    },
  },
  {
    id: "fase2",
    name: "Presença Digital",
    startX: 80,
    startDirection: "right",
    hasBoss: true,
    exitInitiallyOpen: false,
    showExitArrow: true,
    exitDirection: "Forward",
    phaseNumber: 2,
    phaseLabel: "Fase 1",
    skyColor: 0x18233d,
    groundColor: 0x2c3350,
    decorColor: 0x22304f,
    levelWidth: 1990,
    bg: "tec_bg_00.jpg",
    bossX: 1770,
    bossY: 485,
    doorX: 1770,
    groundY: 485,
    characterScale: 2.6,
    infoSpots: [
      {
        x: 345,
        y: 300,
        text: "Estar no Google não exige ter site: com o Perfil da Empresa gratuito, clientes locais acham seu endereço, horário e telefone facilmente.",
      },
      {
        x: 700,
        y: 90,
        text: "No WhatsApp, não envie apenas o preço. Entenda a necessidade do cliente, atenda rápido e conduza a conversa para fechar a venda.",
      },
      {
        x: 1200,
        y: 290,
        text: "Seguidores não pagam contas. Foque em produzir conteúdo útil para o seu público e use a IA para ter ideias e agilizar seus posts.",
      },
    ],
    boss: {
      name: "Estrategista Digital",
      portrait: {
        idle: "boss2_idle.png",
        talk: "boss2_talk.png",
        blink: "boss2_blink.png",
      },
      portraitHeight: 200,
      dialogueBottom: 240,
      greeting:
        "Olá, eu sou Gilmara da Mata, Trainee do Sebrae! Seja bem-vindo à Trilha Digital! Vamos avaliar se sua empresa está realmente preparada para atrair, atender e vender na internet.",
      introLines: [
        "Primeiro desafio sobre presença digital:",
        "Muito bem. Vamos elevar o nível na próxima:",
        "Última pergunta da etapa, foco total:",
      ],
      correctLines: [
        "Perfeito! Visão estratégica afiada.",
        "Exatamente isso! Atendimento e presença andam juntos.",
        "Resposta precisa. Você domina esse fundamento.",
      ],
      wrongLines: [
        "Cuidado, essa é uma armadilha comum na internet:",
        "Não exatamente. Veja onde está o detalhe:",
        "Atenção a este ponto crítico do digital:",
      ],
      resultMessages: {
        3: "Excelente! Você compreende perfeitamente os pilares da presença digital e atendimento moderno.",
        2: "Muito bom resultado! Você já tem boa noção prática, faltando apenas alinhar detalhes de conversão.",
        1: "Você acertou alguns pontos, mas ainda comete erros comuns que custam clientes no dia a dia.",
        0: "Atenção: sua presença digital precisa de ajustes urgentes para não perder vendas para a concorrência.",
      },
      questions: [
        // 1. Fácil (Básico Q1)
        {
          q: "Ter muitos seguidores significa vender mais?",
          options: [
            "Sim, sempre",
            "Não. Seguidores não garantem vendas",
            "Sim, acima de mil seguidores",
            "Apenas no Instagram",
          ],
          correct: 1,
          explanation:
            "Seguidores representam alcance, mas vendas dependem de público qualificado, produto adequado, confiança e bom atendimento.",
        },
        // 2. Fácil (Básico Q2)
        {
          q: "O WhatsApp pode ser um canal de vendas?",
          options: [
            "Não, serve apenas para conversar",
            "Sim, para atender, negociar e vender",
            "Apenas para grandes empresas",
            "Somente para enviar promoções",
          ],
          correct: 1,
          explanation:
            "O WhatsApp se tornou um dos principais canais comerciais diretos, permitindo tirar dúvidas, enviar propostas e fechar vendas.",
        },
        // 3. Fácil (Básico Q3)
        {
          q: "Sua empresa pode aparecer no Google sem ter um site?",
          options: [
            "Não",
            "Sim, com o Perfil da Empresa no Google",
            "Apenas pagando anúncios",
            "Somente se tiver Instagram",
          ],
          correct: 1,
          explanation:
            "Com o Perfil da Empresa no Google (antigo Google Meu Negócio), sua empresa aparece nas buscas locais e no Google Maps gratuitamente.",
        },
        // 4. Fácil (Básico Q5)
        {
          q: "O que é tráfego pago?",
          options: [
            "Venda feita pelo WhatsApp",
            "Divulgação por meio de anúncios pagos",
            "Publicação feita no Instagram",
            "Cadastro da empresa no Google",
          ],
          correct: 1,
          explanation:
            "Tráfego pago consiste em investir dinheiro em plataformas como Meta Ads ou Google Ads para exibir sua mensagem a um público específico.",
        },
        // 5. Fácil (Básico Q10)
        {
          q: "A IA pode ajudar na criação de posts?",
          options: [
            "Não",
            "Sim, com ideias, textos e planejamento",
            "Apenas criando imagens",
            "Somente em anúncios pagos",
          ],
          correct: 1,
          explanation:
            "Ferramentas de IA generativa auxiliam na geração de temas, criação de legendas, roteiros e organização do cronograma de postagens.",
        },
        // 6. Média (Intermediário Q11)
        {
          q: "Seu cliente procura sua empresa no Google e não encontra. O que precisa melhorar?",
          options: [
            "Apenas a fachada",
            "Sua presença digital no Google",
            "O estoque",
            "O número de funcionários",
          ],
          correct: 1,
          explanation:
            "Criar e manter atualizado o Perfil da Empresa no Google garante que clientes encontrem seu horário, contato e localização.",
        },
        // 7. Média (Intermediário Q14)
        {
          q: "Sua empresa recebe muitos contatos no WhatsApp, mas vende pouco. O que deve analisar?",
          options: [
            "Apenas o número de contatos",
            "Como os clientes estão sendo atendidos",
            "O número de grupos",
            "A foto do perfil",
          ],
          correct: 1,
          explanation:
            "Muitas mensagens sem conversão indicam falhas na abordagem, demora na resposta, falta de clareza ou ausência de condução para o fechamento.",
        },
        // 8. Média (Intermediário Q16)
        {
          q: "Uma avaliação positiva no Google pode:",
          options: [
            "Aumentar a confiança de novos clientes",
            "Garantir a primeira posição no Google",
            "Substituir o atendimento",
            "Eliminar a necessidade de divulgação",
          ],
          correct: 0,
          explanation:
            "Avaliações de clientes reais servem como prova social, aumentando a credibilidade e influenciando diretamente a decisão de compra.",
        },
        // 9. Média (Intermediário Q18)
        {
          q: "A IA criou um texto para sua empresa. O que fazer antes de publicar?",
          options: [
            "Publicar imediatamente",
            "Revisar e adaptar ao seu negócio",
            "Acrescentar várias hashtags",
            "Transformar tudo em anúncio",
          ],
          correct: 1,
          explanation:
            "A IA serve como assistente; o empresário deve sempre conferir a precisão das informações e dar o tom de voz autêntico da sua marca.",
        },
        // 10. Média (Intermediário Q20)
        {
          q: "O cliente chama no WhatsApp perguntando apenas 'quanto custa?'. Uma boa resposta é:",
          options: [
            "Enviar somente o preço",
            "Entender a necessidade e apresentar a solução",
            "Pedir que veja o Instagram",
            "Esperar ele perguntar novamente",
          ],
          correct: 1,
          explanation:
            "Jogar apenas o preço reduz o valor percebido. Identifique primeiro o contexto do cliente para justificar os benefícios do que você vende.",
        },
      ],
    },
  },
  {
    id: "fase3",
    name: "Acelerador Digital",
    startX: 80,
    startDirection: "right",
    hasBoss: true,
    exitInitiallyOpen: false,
    phaseNumber: 3,
    phaseLabel: "Fase 3",
    skyColor: 0x18233d,
    groundColor: 0x2c3350,
    decorColor: 0x22304f,
    levelWidth: 1994,
    bg: "tec_bg_01.jpg",
    bossX: 1820,
    bossY: 460,
    doorX: 1750,
    groundY: 460,
    showExitArrow: false,
    characterScale: 2.7,
    infoSpots: [
      {
        x: 180,
        y: 320,
        text: "Antes de impulsionar sua empresa no digital, compreenda melhor sobre o público que você quer alcançar e a mensagem que quer entregar. Vender vai além de alcançar o cliente.",
      },
      {
        x: 850,
        y: 240,
        text: "Fique atento a forma como você posiciona sua empresa no digital. Ter uma estratégia de marketing é fundamental para converter os cliques em vendas.",
      },
      {
        x: 1180,
        y: 260,
        text: "Curtida não paga conta. No tráfego pago, o indicador soberano é o retorno sobre o investimento (ROI) e o custo de cada cliente conquistado.",
      },
    ],
    boss: {
      name: "Especialista em Performance",
      portrait: {
        idle: "boss3_idle.png",
        talk: "boss3_talk.png",
        blink: "boss3_blink.png",
      },
      portraitHeight: 210,
      dialogueBottom: 275,
      greeting:
        "Olá, eu sou Renato Gouveia! Parabéns por chegar ao Acelerador Digital! Vamos analisar sua capacidade de tomar decisões com base em dados, funil de vendas e retorno financeiro.",
        merchanText:
        "Quer dominar o marketing e transformar seguidores em clientes reais? Não perca tempo: conheça a solução Acelerador Digital do Sebrae!",
      qrCode: {
        image: "assets/images/qrcode_acelerador.png",
        duration: 25,
      },
      introLines: [
        "Iniciando a bateria estratégica final:",
        "Muito bom! Vamos aprofundar na análise de dados:",
        "Última questão decisiva da jornada:",
      ],
      correctLines: [
        "Leitura analítica impecável!",
        "Exato! Pensamento de quem domina métricas de verdade.",
        "Resposta cirúrgica. Decisão tomada com base em resultados!",
      ],
      wrongLines: [
        "Cuidado! Essa falha de análise queima orçamento à toa:",
        "Não exatamente. No marketing avançado precisamos olhar o funil:",
        "Atenção: olhar apenas a métrica de vaidade gera prejuízo:",
      ],
      resultMessages: {
        3: "Desempenho genial! Você demonstrou maturidade para gerenciar orçamentos de tráfego e escalar negócios na internet.",
        2: "Ótimo resultado! Você já pensa como gestor de tráfego, precisando apenas calibrar alguns pontos de conversão.",
        1: "Você tem noções importantes, mas ainda confunde métricas de vaidade com vendas reais no fim do mês.",
        0: "Atenção: investir no digital sem entender a jornada do cliente e o pós-clique resulta em desperdício de dinheiro.",
      },
      questions: [
        // 1. Média (Intermediário Q12)
        {
          q: "Antes de anunciar na internet, é importante saber:",
          options: [
            "Quem você deseja alcançar",
            "Quantos funcionários possui",
            "Quantos concorrentes existem",
            "Apenas quanto deseja gastar",
          ],
          correct: 0,
          explanation:
            "Definir a persona e o público-alvo garante que os anúncios sejam exibidos para quem realmente tem interesse e poder de compra.",
        },
        // 2. Média (Intermediário Q13)
        {
          q: "Impulsionar um post e fazer uma campanha estruturada de tráfego pago são a mesma coisa?",
          options: [
            "Sim, sempre",
            "Não. Uma campanha permite estratégias mais completas",
            "Sim, no Instagram",
            "Apenas para pequenos negócios",
          ],
          correct: 1,
          explanation:
            "Campanhas profissionais permitem escolher objetivos de conversão específicos, testar criativos, instalar pixels e mensurar retornos exatos.",
        },
        // 3. Média (Intermediário Q15)
        {
          q: "Qual prática ajuda a vender pelo WhatsApp?",
          options: [
            "Enviar mensagens para todos diariamente",
            "Entender a necessidade do cliente e conduzir o atendimento",
            "Responder apenas com áudios",
            "Enviar somente o preço",
          ],
          correct: 1,
          explanation:
            "Venda consultiva exige escuta ativa, qualificação do interesse e condução clara para a tomada de decisão.",
        },
        // 4. Média (Intermediário Q17)
        {
          q: "Para produzir conteúdo relevante, a empresa deve pensar primeiro:",
          options: [
            "No que seu público precisa ou deseja saber",
            "No número de publicações",
            "Na quantidade de hashtags",
            "Apenas nos produtos mais caros",
          ],
          correct: 0,
          explanation:
            "Conteúdo que gera autoridade e engajamento resolve dores e tira dúvidas reais que o cliente enfrenta no dia a dia.",
        },
        // 5. Média (Intermediário Q19)
        {
          q: "Seu anúncio alcança muitas pessoas, mas poucas demonstram interesse. Uma possível causa é:",
          options: [
            "Público ou mensagem inadequados",
            "Excesso de vendas",
            "Muitas avaliações no Google",
            "Responder rápido demais",
          ],
          correct: 0,
          explanation:
            "Se o criativo (imagem/texto) não dialoga com o interesse do público segmentado, o anúncio é ignorado.",
        },
        // 6. Difícil (Avançado Q21)
        {
          q: "Seu anúncio teve muitos cliques, mas poucas vendas. O que deve ser analisado?",
          options: [
            "Apenas as curtidas",
            "O que acontece depois que a pessoa clica",
            "Apenas o número de seguidores",
            "Aumentar imediatamente o investimento",
          ],
          correct: 1,
          explanation:
            "O anúncio cumpriu o papel de atrair. A falha está na etapa posterior: página com carregamento lento, preço fora da expectativa ou checkout confuso.",
        },
        // 7. Difícil (Avançado Q22)
        {
          q: "Duas campanhas custaram R$ 200. Uma gerou 10 vendas e outra apenas 2. O que importa analisar?",
          options: [
            "Qual teve mais curtidas",
            "O resultado gerado por cada campanha",
            "Qual teve a imagem mais bonita",
            "Qual alcançou mais seguidores",
          ],
          correct: 1,
          explanation:
            "Em anúncios de performance, o Custo por Aquisição (CPA) e o volume de conversão definem qual estratégia deve receber mais verba.",
        },
        // 8. Difícil (Avançado Q24)
        {
          q: "Um anúncio gera muitos contatos no WhatsApp, mas quase nenhuma venda. Onde pode estar o problema?",
          options: [
            "Apenas no anúncio",
            "Na etapa de atendimento e conversão",
            "No número de seguidores",
            "Na quantidade de publicações",
          ],
          correct: 1,
          explanation:
            "Se o lead chega até a conversa, o gargalo está na negociação humana: demora na resposta, falta de script de vendas ou má condução comercial.",
        },
        // 9. Difícil (Avançado Q25)
        {
          q: "Você investiu R$ 300 em anúncios e gerou R$ 3.000 em vendas. Qual informação ainda é importante para avaliar o resultado?",
          options: [
            "Custos e retorno obtido com a campanha",
            "Número de seguidores",
            "Quantidade de posts publicados",
            "Número de concorrentes",
          ],
          correct: 0,
          explanation:
            "Faturamento bruto não é lucro. É indispensável calcular o Retorno sobre Investimento Publicitário (ROAS) descontando o custo das mercadorias vendidas e taxas.",
        },
        // 10. Difícil (Avançado Q30)
        {
          q: "Qual estratégia digital tende a ser mais eficiente?",
          options: [
            "Publicar muito sem analisar resultados",
            "Atrair, atender e acompanhar os resultados",
            "Investir apenas em seguidores",
            "Estar em todas as redes sociais",
          ],
          correct: 1,
          explanation:
            "O ciclo sustentável de vendas online consiste no funil completo: atração qualificada, atendimento ágil e acompanhamento contínuo de métricas.",
        },
      ],
    },
  },
];

// ---------------------------------------------------------
// HELPERS GERAIS
// ---------------------------------------------------------
function pickRandom(arr, n) {
  const copy = [...arr];
  const result = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function shuffleQuestion(question) {
  const items = question.options.map((text, index) => ({
    text,
    isCorrect: index === question.correct,
  }));

  // Embaralhamento Fisher-Yates
  for (let i = items.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    [items[i], items[randomIndex]] = [items[randomIndex], items[i]];
  }

  return {
    ...question,
    options: items.map((item) => item.text),
    correct: items.findIndex((item) => item.isCorrect),
  };
}

function updateHUD() {
  const currentPhase = PHASES[GameData.phaseIndex];

  document.getElementById("hud-objective").textContent =
    currentPhase?.objectiveHint ?? "";
  document.getElementById("hud-lives").textContent =
    "❤️".repeat(Math.max(GameData.lives, 0)) || "💀";

  document.getElementById("score-value").textContent = GameData.score;

  if (!currentPhase) return;

  document.getElementById("phase-label").textContent =
    currentPhase.phaseLabel ??
    `Fase ${currentPhase.phaseNumber ?? GameData.phaseIndex + 1}`;

  document.getElementById("phase-name").textContent = currentPhase.name;
}

// Conta quantos murais da fase atual já foram vistos (só estatística/flavor, não pontua)
function updateMuraisCounter(phaseId, total) {
  let count = 0;
  GameData.infosSeen.forEach((id) => {
    if (id.startsWith(`${phaseId}_`)) count += 1;
  });
  document.getElementById("hud-murais-count").textContent = count;
  document.getElementById("hud-murais-total").textContent = total;
}

function loadRanking() {
  try {
    return JSON.parse(localStorage.getItem(RANKING_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveRankingEntry(name, score, elapsedSeconds) {
  const ranking = loadRanking();
  ranking.push({
    name: name || "Anônimo",
    score,
    time: elapsedSeconds,
    date: new Date().toLocaleDateString("pt-BR"),
  });
  ranking.sort((a, b) => b.score - a.score);
  const top10 = ranking.slice(0, 10);
  localStorage.setItem(RANKING_KEY, JSON.stringify(top10));
  return top10;
}

function renderRankingInto(elId) {
  const list = loadRanking();
  const el = document.getElementById(elId);
  if (list.length === 0) {
    el.innerHTML = "<p>Ninguém no ranking ainda. Seja o primeiro!</p>";
    return;
  }
  const items = list
    .map(
      (r) =>
        `<li>${escapeHtml(r.name)} — ${r.score} pts (${r.time}s) — ${r.date}</li>`,
    )
    .join("");
  el.innerHTML = `<ol>${items}</ol>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------
// FÓRMULA DE PONTUAÇÃO
// Considera SOMENTE: acertos, vidas restantes e tempo total.
// Exploração/murais NÃO entram na conta (só servem para aprender).
// ---------------------------------------------------------
function computeFinalScore() {
  const livesBonus = GameData.lives * 50; // bônus final por vida restante — ajuste esse valor à vontade
  return GameData.score + livesBonus;
}

function formatMessageForScore(score) {
  if (score >= 1000)
    return "Excelente empresário! Você domina os conceitos essenciais da gestão.";
  if (score >= 700)
    return "Muito bom! Você já entende bastante, mas ainda pode evoluir.";
  return "Você deu o primeiro passo. Vale a pena revisar alguns conceitos com calma.";
}

// ---------------------------------------------------------
// SISTEMA DE INPUT (abstrai teclado / touch / gamepad)
// Hoje só o teclado está implementado. Para adicionar touch ou
// gamepad no futuro, basta criar uma classe com os mesmos métodos
// (isLeft/isRight/isJump/isDuck) e registrar em InputManager.providers.
// ---------------------------------------------------------
class KeyboardInputProvider {
  constructor(scene) {
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.keys = scene.input.keyboard.addKeys({ A: "A", D: "D" });
  }
  isLeft() {
    return this.cursors.left.isDown || this.keys.A.isDown;
  }
  isRight() {
    return this.cursors.right.isDown || this.keys.D.isDown;
  }
}
class TouchInputProvider {
  constructor() {
    this.leftDown = false;
    this.rightDown = false;

    const bind = (el, setter) => {
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        setter(true);
      };
      const end = (e) => {
        e.preventDefault();
        setter(false);
      };
      el.addEventListener("touchstart", start, { passive: false });
      el.addEventListener("touchend", end);
      el.addEventListener("touchcancel", end);
      el.addEventListener("mousedown", start);
      el.addEventListener("mouseup", end);
      el.addEventListener("mouseleave", end);
    };

    bind(document.getElementById("btn-left"), (v) => {
      this.leftDown = v;
    });
    bind(document.getElementById("btn-right"), (v) => {
      this.rightDown = v;
    });
  }
  isLeft() {
    return this.leftDown;
  }
  isRight() {
    return this.rightDown;
  }
}

// Instância única — criada uma vez só (os botões são elementos HTML fora do Phaser,
// não recriar isso a cada fase, senão os cliques duplicam)
const touchInput = new TouchInputProvider();

// TODO (futuro): class TouchInputProvider { ... }  -> botões on-screen
// TODO (futuro): class GamepadInputProvider { ... } -> this.scene.input.gamepad
// TODO (futuro): se pular/agachar voltarem a fazer sentido (ex: obstáculos), reintroduzir
// isJump()/isDuck() aqui e no InputManager abaixo — a arquitetura já está pronta pra isso.

class InputManager {
  constructor(scene) {
    this.providers = [new KeyboardInputProvider(scene), touchInput];
    this.enabled = true;
  }
  setEnabled(v) {
    this.enabled = v;
  }
  left() {
    return this.enabled && this.providers.some((p) => p.isLeft());
  }
  right() {
    return this.enabled && this.providers.some((p) => p.isRight());
  }
}

// ---------------------------------------------------------
// PIXEL ART — geração de texturas via grid de caracteres
// ---------------------------------------------------------
function drawPixelTexture(scene, key, rows, palette, pixelSize) {
  if (scene.textures.exists(key)) return;
  const height = rows.length;
  const width = rows[0].length;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x];
      if (ch === "." || palette[ch] === undefined) continue;
      g.fillStyle(palette[ch], 1);
      g.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }
  g.generateTexture(key, width * pixelSize, height * pixelSize);
  g.destroy();
}

const BOSS_PALETTE = { R: THEME.danger, K: 0x1a1a1a, G: 0x555555 };
const BOSS_FRAME = [
  "..RRRRRRRRRR..",
  ".RRRRRRRRRRRR.",
  "RRRRKKKKKKRRRR",
  "RRRRK....KRRRR",
  "RRRRKKKKKKRRRR",
  ".RRRRRRRRRRRR.",
  ".RRRRRRRRRRRR.",
  "..RRRRRRRRRR..",
  "...GGGGGGGG...",
  "...GGGGGGGG...",
  "...GGGGGGGG...",
  "...GG....GG...",
  "...GG....GG...",
  "...GG....GG...",
];

const POSTER_FRAME = [
  "............",
  "...BBBBBB...",
  "..BWWWWWWB..",
  ".BWWWWWWWWB.",
  ".BWWDWDWDWB.",
  ".BWWWWWWWWB.",
  "..BWWWWWWB..",
  "...BBBBBB...",
  ".....BB.....",
  "....BB......",
];

const POSTER_PALETTE = {
  B: 0xf5f0e6, // borda dourada
  W: 0xf5f0e6, // interior claro
  D: 0x14213d, // três pontos azuis
};

const DOOR_PALETTE = { F: 0x8a5a2b, D: 0x6b4423, K: THEME.accent };
const DOOR_FRAME = [
  "FFFFFFFFFF",
  "FDDDDDDDDF",
  "FDDDDDDDDF",
  "FDDDDDDDDF",
  "FDDDDDDDDF",
  "FDDDDDDDDF",
  "FDDDDKDDDF",
  "FDDDDDDDDF",
  "FDDDDDDDDF",
  "FDDDDDDDDF",
  "FDDDDDDDDF",
  "FFFFFFFFFF",
];

function buildAllTextures(scene) {
  const PS = 4; // tamanho do "pixel" em px reais
  drawPixelTexture(scene, "bossTex", BOSS_FRAME, BOSS_PALETTE, PS);
  drawPixelTexture(scene, "posterTex", POSTER_FRAME, POSTER_PALETTE, PS);
  drawPixelTexture(scene, "doorTex", DOOR_FRAME, DOOR_PALETTE, PS);

  if (!scene.textures.exists("ground")) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(THEME.primary, 1);
    g.fillRect(0, 0, 64, 64);
    g.lineStyle(2, THEME.primaryDark, 1);
    g.strokeRect(0, 0, 64, 64);
    g.generateTexture("ground", 64, 64);
    g.destroy();
  }
}

// ---------------------------------------------------------
// TELA DE FIM DE JOGO (vitória ou derrota) — pontuação salva automaticamente
// ---------------------------------------------------------
function endGame(won) {
  if (GameData.hasEnded) return; 
  GameData.hasEnded = true;

  const elapsedSeconds = Math.floor((Date.now() - GameData.startTime) / 1000);
  const finalScore = computeFinalScore(elapsedSeconds);

  saveRankingEntry(GameData.playerName, finalScore, elapsedSeconds);

  // Lógica isolada para exibir a tela de pontuação
  const showGameOverScreen = () => {
    document.getElementById("end-overlay").classList.remove("hidden");
    document.getElementById("end-title").textContent = won ? "🏆 Parabéns!" : "Game Over";
    document.getElementById("end-message").textContent = won
      ? "Você completou as três fases e agora conhece melhor os desafios da gestão empresarial!"
      : "Você ficou sem vidas no meio da jornada. Que tal tentar de novo?";

    document.getElementById("end-score").innerHTML = `
      Respostas corretas: ${GameData.correctAnswers}<br/>
      Vidas restantes: ${GameData.lives}<br/>
      Tempo total: ${elapsedSeconds}s<br/>
      Murais lidos (curiosidade, não pontua): ${GameData.infosSeen.size}<br/>
      <strong>Pontuação final: ${finalScore}</strong><br/>
      ${formatMessageForScore(finalScore)}
    `;
  };

  // Se perdeu o jogo, mostra o modal do QR Code primeiro
  if (!won) {
    showQRCodeModal({
      image: "assets/images/qrcode_acelerador.png",
      duration: 30, // Tempo de tela para o Game Over
      title: "Não desista do seu negócio!",
      text: "Quer dominar o marketing e transformar seguidores em clientes reais? Aponte a câmera e conheça o Acelerador Digital do Sebrae antes de jogar novamente:"
    }, () => {
      // Assim que o timer acabar (ou o jogador fechar), mostra o Game Over normal
      showGameOverScreen();
    });
  } else {
    // Se ganhou, o boss final já mostrou o QR Code, então vai direto pra tela de vitória
    showGameOverScreen();
  }
}

// ---------------------------------------------------------
// BATALHA DE BOSS — PAUSA o jogo (física + input) enquanto ativa
// ---------------------------------------------------------
function positionBossDialogue(scene, bossSprite) {
  const bounds = bossSprite.getBounds();
  const scrollX = scene.cameras.main.scrollX;
  let screenX = bounds.centerX - scrollX;

  // Mantém a caixa centralizada horizontalmente no boss, respeitando as margens
  screenX = Math.min(Math.max(screenX, 170), 960 - 170);

  const dialogueEl = document.getElementById("boss-dialogue");
  dialogueEl.style.left = `${screenX}px`;

  // Lê a altura manual definida na constante PHASES para o boss desta fase específica
  const manualBottom = scene.config?.boss?.dialogueBottom;

  if (manualBottom !== undefined) {
    // Usa o valor manual exato que você definir (ex: 180, 220, 250)
    dialogueEl.style.bottom = `${manualBottom}px`;
  } else {
    // Fallback de segurança (caso não haja 'dialogueBottom' configurado na fase)
    const screenTopY = bounds.top;
    let bottom = 540 - screenTopY + 18;
    const boxHeight = dialogueEl.offsetHeight || 120;
    const minBottom = 160;
    const maxBottom = 540 - 60 - boxHeight;
    bottom = Math.min(Math.max(bottom, minBottom), maxBottom);
    dialogueEl.style.bottom = `${bottom}px`;
  }
}

// Frases de transição do "boss falando" — variam um pouco por pergunta pra não ficar repetitivo.
// Fique à vontade pra editar/adicionar mais frases nessas listas.
const BOSS_INTRO_LINES = [
  "Vamos testar seus conhecimentos sobre isso!",
  "Aqui vai a próxima pergunta:",
  "Última pergunta, vamos lá:",
];
const BOSS_CORRECT_LINES = [
  "Isso mesmo! Mandou bem.",
  "Perfeito, é exatamente isso!",
  "Excelente resposta!",
];
const BOSS_WRONG_LINES = [
  "Não foi dessa vez.",
  "Quase! Deixa eu te explicar:",
  "Essa é traiçoeira, mas vamos entender:",
];
const TYPE_SPEED_MS = 60; // velocidade da digitação (ms por letra) — aumente pra deixar mais devagar, diminua pra mais rápido
const INFO_TYPE_SPEED_MS = 35;

function pickLine(list, index) {
  return list[Math.min(index, list.length - 1)];
}

function startBossBattle(scene, phaseConfig, bossSprite, onComplete) {
  const mySession = GameData.sessionId; // trava esta batalha à partida atual
  GameData.paused = true;
  scene.physics.pause();
  scene.inputManager.setEnabled(false);

  positionBossDialogue(scene, bossSprite);

  const overlay = document.getElementById("boss-overlay");
  const nameEl = document.getElementById("boss-name");
  const headerEl = document.getElementById("dialogue-header");
  const questionEl = document.getElementById("question-text");
  const answersPanelEl = document.getElementById("boss-answers-panel");
  const optionsEl = document.getElementById("question-options");

  overlay.classList.remove("hidden");
  nameEl.textContent = ` ${phaseConfig.boss.name}`;

  const questions = pickRandom(phaseConfig.boss.questions, 3).map((question) =>
    shuffleQuestion(question),
  );
  let qIndex = 0;
  let battleCorrectCount = 0;
  let timeLeft = ANSWER_SECONDS;
  let timerInterval = null;
  let typeInterval = null;
  let tickPlayedThisQuestion = false; // garante 1 disparo do tick por pergunta, tocando os 5s inteiros
  const typeState = { instant: false };

  function isStale() {
    return mySession !== GameData.sessionId;
  }

  // Efeito de "digitação" — clicar no balão pula direto pro texto completo
  // Efeito de "digitação" — clicar no balão pula direto pro texto completo
  function typeText(text, onDone) {
    clearInterval(typeInterval);
    questionEl.textContent = "";
    headerEl.textContent = "";
    typeState.instant = false;
    scene.startBossTalkAnim?.();

    let i = 0;
    typeInterval = setInterval(() => {
      if (isStale()) {
        clearInterval(typeInterval);
        scene.stopBossTalkAnim?.();
        return;
      }

      // === CORREÇÃO DO PAUSE ===
      // Se o modal de pause manual estiver aberto, congela a digitação, o áudio e a boca do boss
      const pauseModal = document.getElementById("pause-modal");
      if (pauseModal && !pauseModal.classList.contains("hidden")) {
        scene.stopBossTalkAnim?.();
        return;
      } else {
        // Garante que a boca volte a mexer caso o jogo seja despausado
        scene.startBossTalkAnim?.();
      }
      // =========================

      if (typeState.instant) {
        questionEl.textContent = text;
        positionBossDialogue(scene, bossSprite);
        clearInterval(typeInterval);
        scene.stopBossTalkAnim?.();
        if (onDone) onDone();
        return;
      }

      i += 1;
      questionEl.textContent = text.slice(0, i);
      playSfx(SFX.type); // O áudio só toca se passar do bloqueio do pause acima
      positionBossDialogue(scene, bossSprite);

      if (i >= text.length) {
        clearInterval(typeInterval);
        scene.stopBossTalkAnim?.();
        if (onDone) onDone();
      }
    }, TYPE_SPEED_MS);
  }
  questionEl.onclick = () => {
    typeState.instant = true;
  };

  // Etapa 1: boss "fala" uma introdução, depois a pergunta em si, só então libera as alternativas
  function playIntroThenQuestion(index) {
    if (isStale()) return;
    answersPanelEl.classList.add("hidden");
    const q = questions[index];
    const introLines = phaseConfig.boss.introLines || BOSS_INTRO_LINES;
    typeText(pickLine(introLines, index), () => {
      if (isStale()) return;
      setTimeout(() => {
        if (isStale()) return;
        typeText(q.q, () => revealOptions(q));
      }, 900);
    });
  }

  // Etapa 2: alternativas aparecem, começa o cronômetro de resposta
  function revealOptions(q) {
    if (isStale()) return;
    answersPanelEl.classList.remove("hidden");
    optionsEl.innerHTML = "";

    q.options.forEach((optText, idx) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = optText;
      btn.onclick = () => {
        if (isStale()) return;
        clearInterval(timerInterval);
        resolveAnswer(idx, q);
      };
      optionsEl.appendChild(btn);
    });

    timeLeft = ANSWER_SECONDS; // reinicia (sem "let" — já é a variável compartilhada lá de cima)
    tickPlayedThisQuestion = false; // libera o tick pra tocar de novo nesta pergunta
    headerEl.textContent = `⏱ ${timeLeft}s`;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (isStale()) {
        clearInterval(timerInterval);
        return;
      }

      const pauseModal = document.getElementById("pause-modal");
      if (pauseModal && !pauseModal.classList.contains("hidden")) return;

      timeLeft -= 1;
      headerEl.textContent = `⏱ ${timeLeft}s`;

      if (timeLeft === 5 && !tickPlayedThisQuestion) {
        tickPlayedThisQuestion = true;
        playSfx(SFX.tick);
      }
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        resolveAnswer(null, q);
      }
    }, 1000);
  }

  // Etapa 3: boss reage (parabeniza ou explica o motivo do erro), depois avança
  function resolveAnswer(chosenIdx, q) {
    if (isStale()) return;
    stopSfx(SFX.tick); // corta o áudio de contagem na hora — responder antes do tempo não deve deixar o som terminando sozinho
    const timedOut = chosenIdx === null;
    const isCorrect = !timedOut && chosenIdx === q.correct;
    answersPanelEl.classList.add("hidden");

    if (isCorrect) {
      GameData.correctAnswers += 1;
      battleCorrectCount += 1;

      const BASE_POINTS = 60; // todo acerto garante isso
      const MAX_SPEED_BONUS = 40; // até isso a mais, se responder na hora
      const speedBonus = Math.round(
        (timeLeft / ANSWER_SECONDS) * MAX_SPEED_BONUS,
      );
      GameData.score += BASE_POINTS + speedBonus; // acerto rápido = até 100 pts; no fim do tempo = 60 pts
    } else {
      GameData.lives -= 1; // errar (ou tempo esgotado) não soma nada
    }
    updateHUD();

    const correctLines = phaseConfig.boss.correctLines || BOSS_CORRECT_LINES;
    const wrongLines = phaseConfig.boss.wrongLines || BOSS_WRONG_LINES;

    let resultText;
    if (isCorrect) {
      resultText = pickLine(correctLines, qIndex);
    } else if (timedOut) {
      resultText = `O tempo acabou! Essa questão foi considerada incorreta. ${q.explanation}`;
    } else {
      resultText = `${pickLine(wrongLines, qIndex)} ${q.explanation}`;
    }

    typeText(resultText, () => {
      if (isStale()) return;
      const waitTime = isCorrect ? 1400 : 3200;
      setTimeout(() => {
        if (isStale()) return;
        qIndex += 1;
        if (GameData.lives <= 0) {
          overlay.classList.add("hidden");
          finishBossUI({ keepGamePaused: true }); // <-- não libera mais o jogo
          endGame(false);
          return;
        }
        if (qIndex < questions.length) {
          playIntroThenQuestion(qIndex);
        } else {
          finishBattleWithResult();
        }
      }, waitTime);
    });
  }

  // Mostra a mensagem final (varia conforme o desempenho: 3/3, 2/3, 1/3 ou 0/3) antes de liberar a saída
  function finishBattleWithResult() {
    const msg = phaseConfig.boss.resultMessages?.[battleCorrectCount];

    const proceedToMerchanOrFinish = () => {
      if (phaseConfig.boss.merchanText && phaseConfig.boss.qrCode) {
        typeText(phaseConfig.boss.merchanText, () => {
          setTimeout(() => {
            if (isStale()) return;
            overlay.classList.add("hidden");
            showQRCodeModal(phaseConfig.boss.qrCode, () => {
              finishBossUI();
              onComplete();
            });
          }, 1600);
        });
      } else {
        overlay.classList.add("hidden");
        finishBossUI();
        onComplete();
      }
    };

    if (msg) {
      typeText(msg, () => {
        setTimeout(() => {
          if (isStale()) return;
          proceedToMerchanOrFinish();
        }, 1800);
      });
    } else {
      proceedToMerchanOrFinish();
    }
  }

  function finishBossUI({ keepGamePaused = false } = {}) {
    clearInterval(timerInterval);
    clearInterval(typeInterval);
    questionEl.onclick = null;
    if (!keepGamePaused) {
      GameData.paused = false;
      scene.physics.resume();
      scene.inputManager.setEnabled(true);
    }
  }

  if (phaseConfig.boss.greeting) {
    typeText(phaseConfig.boss.greeting, () => {
      setTimeout(() => playIntroThenQuestion(qIndex), 900);
    });
  } else {
    playIntroThenQuestion(qIndex);
  }
}

// ---------------------------------------------------------
// BALÃO DE INFORMAÇÃO DOS NPCS
// Abre por proximidade, digita letra por letra e fecha ao se afastar.
// Não pausa o jogo.
// ---------------------------------------------------------

let activeInfoId = null;
let infoTypeInterval = null;

function typeInfoText(element, text) {
  clearInterval(infoTypeInterval);
  element.textContent = "";
  let charIndex = 0;

  infoTypeInterval = setInterval(() => {
    // === TRAVA DO PAUSE ===
    // Se o modal de pause estiver aberto, ignora este ciclo (congela texto e áudio)
    const pauseModal = document.getElementById("pause-modal");
    if (pauseModal && !pauseModal.classList.contains("hidden")) {
      return;
    }
    // ======================

    charIndex += 1;
    element.textContent = text.slice(0, charIndex);
    playSfx(SFX.type); // Áudio só toca se passar do bloqueio do pause

    if (charIndex >= text.length) {
      clearInterval(infoTypeInterval);
      infoTypeInterval = null;
    }
  }, INFO_TYPE_SPEED_MS);
}

function animateInfoBubbleOpening(bubble) {
  bubble.classList.remove("info-bubble-opening");

  // Força o navegador a reiniciar a animação
  void bubble.offsetWidth;

  bubble.classList.add("info-bubble-opening");
}

function positionInfoBubble(scene, spot) {
  const bubble = document.getElementById("info-bubble");
  const camera = scene.cameras.main;

  let screenX = spot.x - camera.scrollX;
  let screenY = (spot.y ?? 300) - camera.scrollY;

  const halfBubbleWidth = 165;

  screenX = Phaser.Math.Clamp(screenX, halfBubbleWidth, 960 - halfBubbleWidth);

  screenY = Math.max(screenY, 115);

  bubble.style.left = `${screenX}px`;
  bubble.style.top = `${screenY - 8}px`;
}

function updateInfoBubble(scene, playerX, infoSpots, phaseId, infoIcons) {
  // Enquanto "segurada" (tempo mínimo de leitura), continua atualizando a POSIÇÃO
  // na tela (acompanhando o scroll da câmera) — só não reavalia nem reinicia a digitação.
  if (scene.pinnedInfoUntil && Date.now() < scene.pinnedInfoUntil) {
    if (scene.pinnedSpot) positionInfoBubble(scene, scene.pinnedSpot);
    return;
  }
  scene.pinnedInfoUntil = null;
  scene.pinnedSpot = null;

  let nearest = null;
  let nearestDist = Infinity;

  infoSpots.forEach((spot, index) => {
    if (spot.once && scene.usedOnceSpots?.has(index)) return;

    const distance = Math.abs(playerX - spot.x);
    if (distance <= INFO_PROXIMITY_RADIUS && distance < nearestDist) {
      const text =
        spot.textAfterBoss && scene.doorOpen ? spot.textAfterBoss : spot.text;
      nearest = { id: `${phaseId}_${index}`, index, spot, text };
      nearestDist = distance;
    }
  });

  const bubble = document.getElementById("info-bubble");
  const content = bubble.querySelector(".info-bubble-content");

  if (nearest) {
    positionInfoBubble(scene, nearest.spot);

    if (activeInfoId !== nearest.id) {
      activeInfoId = nearest.id;
      GameData.infosSeen.add(nearest.id);
      updateMuraisCounter(phaseId, infoSpots.length);
      clearInterval(infoTypeInterval);

      if (infoIcons?.[nearest.index]) {
        infoIcons[nearest.index].setVisible(false);
      }

      if (nearest.spot.once) {
        scene.usedOnceSpots?.add(nearest.index);
        scene.pinnedInfoUntil = Date.now() + ONCE_BUBBLE_MIN_MS;
        scene.pinnedSpot = nearest.spot;
      }

      bubble.classList.remove("info-bubble-hidden");
      animateInfoBubbleOpening(bubble);
      typeInfoText(content, ` ${nearest.text}`);
    }
    return;
  }

  if (activeInfoId !== null) {
    const previousIndex = Number(activeInfoId.split("_").at(-1));
    const previousSpot = infoSpots[previousIndex];
    activeInfoId = null;

    clearInterval(infoTypeInterval);
    infoTypeInterval = null;

    bubble.classList.remove("info-bubble-opening");
    bubble.classList.add("info-bubble-hidden");

    setTimeout(() => {
      if (bubble.classList.contains("info-bubble-hidden"))
        content.textContent = "";
    }, 220);

    const staysHidden =
      previousSpot?.once && scene.usedOnceSpots?.has(previousIndex);
    if (infoIcons?.[previousIndex] && !staysHidden) {
      infoIcons[previousIndex].setVisible(true);
    }
  }
}

// ---------------------------------------------------------
// CENA PRINCIPAL DO PHASER
// ---------------------------------------------------------
function showPhaseIntro(phaseConfig, onComplete) {
  const intro = document.getElementById("phase-intro");
  const label = document.getElementById("phase-intro-label");
  const name = document.getElementById("phase-intro-name");

  label.textContent =
    phaseConfig.phaseLabel ?? `Fase ${phaseConfig.phaseNumber ?? ""}`;

  name.textContent = phaseConfig.name;

  intro.classList.remove("hidden", "phase-intro-visible");

  void intro.offsetWidth;

  intro.classList.add("phase-intro-visible");

  setTimeout(() => {
    intro.classList.add("hidden");
    intro.classList.remove("phase-intro-visible");

    if (onComplete) onComplete();
  }, 2600);
}

// ---------------------------------------------------------
// SISTEMA DO NARRADOR ANIMADO (Ciclo Fluido de 4 Frames Ajustado)
// ---------------------------------------------------------
function chamarNarrador(cena, avatarKeys, audioKey, texto, onComplete) {
  const overlay = cena.add
    .rectangle(480, 270, 960, 540, 0x000000, 0.8)
    .setOrigin(0.5)
    .setDepth(100)
    .setScrollFactor(0)
    .setInteractive();

  const box = cena.add.graphics().setDepth(101).setScrollFactor(0);
  box.fillStyle(0x002b54, 1);
  box.lineStyle(4, 0xff8f00, 1);

  // AJSUTES AQUI: Y subiu de 120 para 80 | Altura aumentou de 280 para 340
  box.fillRoundedRect(230, 80, 500, 340, 16);
  box.strokeRoundedRect(230, 80, 500, 340, 16);

  // Avatar puxado levemente para baixo (Y de 175 para 200) para encaixar perfeitamente
  const avatar = cena.add
    .image(480, 190, avatarKeys.idle)
    .setDepth(102)
    .setScrollFactor(0);

  const targetHeight = 165;
  const sourceImage = cena.textures.get(avatarKeys.idle).getSourceImage();
  if (sourceImage && sourceImage.height > 0) {
    const scale = targetHeight / sourceImage.height;
    avatar.setScale(scale);
  }

  // Texto da mensagem ajustado de 280 para 295 (desce um pouco, criando o espaço)
  const messageText = cena.add
    .text(480, 295, "", {
      fontSize: "20px",
      fontFamily: "Arial",
      color: "#F4F7F9",
      align: "center",
      wordWrap: { width: 420 },
    })
    .setOrigin(0.5, 0)
    .setDepth(102)
    .setScrollFactor(0);

  // Texto "Clique para continuar" reposicionado para o rodapé da nova caixa
  const hintText = cena.add
    .text(480, 385, "Clique para continuar ➡", {
      fontSize: "16px",
      fontStyle: "italic",
      color: "#FFB347",
    })
    .setOrigin(0.5, 0)
    .setDepth(102)
    .setScrollFactor(0)
    .setAlpha(0);

  let voice;
  if (audioKey && cena.cache.audio.exists(audioKey)) {
    voice = cena.sound.add(audioKey);
    voice.play();
  }

  // Verifica se é o Narrador (animação fluida) ou o Jogador (animação simples)
  const isMultiFrame = avatarKeys.idle === "narrador_idle";

  // --- SEQUÊNCIAS DE IDAS E VINDAS ---
  // A boca agora começa fechada (narrador_idle), abre até o limite e volta a fechar
  const talkSequence = isMultiFrame
    ? [
        "narrador_idle", // <-- Incluído no fluxo de talk (boca fechada)
        "narrador_talk_1",
        "narrador_talk_2",
        "narrador_talk_2",
        "narrador_talk_1",
      ]
    : [avatarKeys.idle, avatarKeys.talk || avatarKeys.idle];

  const blinkSequence = isMultiFrame
    ? ["narrador_blink_1", "narrador_blink_4", "narrador_blink_1"]
    : null;

  let isTalking = true;
  let talkIndex = 0;
  let isBlinking = false;
  let blinkIndex = 0;
  let tempoAtePiscar = Phaser.Math.Between(35, 70);

  // Tratamento de segurança para o texto não quebrar o loop
  const textoSeguro = texto || "";

  const animInterval = setInterval(() => {
    tempoAtePiscar--;

    if (isBlinking && blinkSequence) {
      avatar.setTexture(blinkSequence[blinkIndex]);
      blinkIndex++;
      if (blinkIndex >= blinkSequence.length) {
        isBlinking = false;
        blinkIndex = 0;
      }
      return;
    }

    if (tempoAtePiscar <= 0 && blinkSequence) {
      isBlinking = true;
      blinkIndex = 0;
      tempoAtePiscar = Phaser.Math.Between(25, 45);
      return;
    }

    if (isTalking) {
      avatar.setTexture(talkSequence[talkIndex]);
      talkIndex = (talkIndex + 1) % talkSequence.length;
    } else {
      avatar.setTexture(avatarKeys.idle);
    }
  }, 90);

  let charIndex = 0;
  let isTyping = true;
  const typeInterval = setInterval(() => {
    charIndex++;
    messageText.setText(textoSeguro.slice(0, charIndex));
    playSfx(SFX.type);

    if (charIndex >= textoSeguro.length) {
      clearInterval(typeInterval);
      isTyping = false;
      isTalking = false; // Isso para a animação da boca imediatamente
      avatar.setTexture(avatarKeys.idle);
      hintText.setAlpha(1);
    }
  }, 40);

  overlay.on("pointerdown", () => {
    if (isTyping) {
      clearInterval(typeInterval);
      messageText.setText(textoSeguro);
      isTyping = false;
      isTalking = false; // Trava a boca fechada ao pular o texto
      avatar.setTexture(avatarKeys.idle);
      hintText.setAlpha(1);
    } else {
      clearInterval(animInterval);
      if (voice && voice.isPlaying) voice.stop();
      overlay.destroy();
      box.destroy();
      avatar.destroy();
      messageText.destroy();
      hintText.destroy();

      if (onComplete) onComplete();
    }
  });
}

// ---------------------------------------------------------
// CENA DO MAPA DAS ILHAS (Com Animação de Desbloqueio)
// ---------------------------------------------------------
class MapScene extends Phaser.Scene {
  constructor() {
    super("MapScene");
  }

  preload() {
    // Assets exclusivos do Mapa (A MapScene NÃO usa this.config)
    if (!this.textures.exists("map_bg")) {
      this.load.image("map_bg", "assets/backgrounds/map_bg.png");
    }
    if (!this.textures.exists("icon_locked")) {
      this.load.image("icon_locked", "assets/icons/cadeado.png");
      this.load.image("icon_check", "assets/icons/check.png");
    }
    // Ícone do barquinho para a animação
    if (!this.textures.exists("icon_boat")) {
      this.load.image("icon_boat", "assets/icons/barco.png");
    }
    // Carregamento do Narrador no Mapa
    if (!this.textures.exists("narrador_idle")) {
      this.load.image(
        "narrador_idle",
        "assets/characters/narrador_blink_1.png",
      );

      this.load.image(
        "narrador_talk_1",
        "assets/characters/narrador_talk_1.png",
      );
      this.load.image(
        "narrador_talk_2",
        "assets/characters/narrador_talk_2.png",
      );

      this.load.image(
        "narrador_blink_1",
        "assets/characters/narrador_blink_1.png",
      );
      this.load.image(
        "narrador_blink_4",
        "assets/characters/narrador_blink_4.png",
      );
    }
    if (!this.cache.audio.exists("voz_mapa")) {
      this.load.audio("voz_mapa", "assets/audio/voz_mapa.mp3");
    }
  }

  create() {
    document.getElementById("hud").style.display = "none";
    document.getElementById("touch-controls").style.display = "none";
    const hud = document.getElementById("hud");
    if (hud) hud.style.display = "none";
    const btnLeft = document.getElementById("btn-left");
    if (btnLeft) btnLeft.style.display = "none";
    const btnRight = document.getElementById("btn-right");
    if (btnRight) btnRight.style.display = "none";

    const bg = this.add.image(480, 270, "map_bg").setDepth(0);
    bg.setDisplaySize(960, 540);

    const islands = [
      {
        id: 0,
        name: "FINECAP",
        x: 175,
        y: 450,
        arrowX: 190,
        arrowY: 210,
        iconX: 170,
        iconY: 365,
      },
      {
        id: 1,
        name: "PRESENÇA DIGITAL",
        x: 510,
        y: 200,
        arrowX: 510,
        arrowY: 60,
        iconX: 510,
        iconY: 135,
      },
      {
        id: 2,
        name: "ACELERADOR DIGITAL",
        x: 830,
        y: 450,
        arrowX: 820,
        arrowY: 240,
        iconX: 820,
        iconY: 400,
      },
    ];

    const pathGraphics = this.add.graphics().setDepth(1);
    pathGraphics.lineStyle(4, 0xffe27a, 0.8);

    for (let i = 0; i < islands.length - 1; i++) {
      this.drawDottedLine(
        pathGraphics,
        islands[i].x,
        islands[i].y,
        islands[i + 1].x,
        islands[i + 1].y,
      );
    }

    if (GameData.lastPhaseIndex === undefined)
      GameData.lastPhaseIndex = GameData.phaseIndex;

    const isUnlocking = GameData.lastPhaseIndex < GameData.phaseIndex;
    let targetIslandObj = null;

    islands.forEach((island) => {
      let status = "locked";
      if (island.id < GameData.phaseIndex) {
        status = "completed";
      } else if (island.id === GameData.phaseIndex) {
        status = isUnlocking ? "unlocking" : "current";
      }

      const zone = this.add
        .zone(island.x, island.y - 30, 220, 220)
        .setInteractive({ useHandCursor: true })
        .setDepth(20);
      this.criarPlacaArredondada(
        island.x,
        island.y + 60,
        island.name,
        0x002b54,
        "#F4F7F9",
      );

      if (status === "completed") {
        const check = this.add
          .image(island.iconX, island.iconY, "icon_check")
          .setOrigin(0.5)
          .setDepth(5)
          .setScale(0)
          .setAlpha(0);

        // Identifica se esta ilha foi a que acabou de ser vencida
        const justCompleted = isUnlocking && island.id === GameData.lastPhaseIndex;

        // Animação de "Pop-up" elástico com disparo do áudio
        this.tweens.add({
          targets: check,
          scale: 0.5,
          alpha: 1,
          duration: 600,
          ease: "Back.easeOut",
          delay: island.id * 150,
          onStart: () => {
            if (justCompleted) {
              playSfx(SFX.complete);
            }
          },
        });
      } else if (status === "locked") {
        island.lockedImg = this.add
          .image(island.iconX, island.iconY, "icon_locked")
          .setOrigin(0.5)
          .setDepth(5)
          .setScale(0.1);
      } else if (status === "unlocking") {
        targetIslandObj = island;

        island.padlockImg = this.add
          .image(island.iconX, island.iconY, "icon_locked")
          .setOrigin(0.5)
          .setDepth(5)
          .setScale(0.1);

        island.arrowText = this.add
          .text(island.arrowX, island.arrowY, "⬇", {
            fontSize: "60px",
            color: "#FF8F00",
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setDepth(10)
          .setVisible(false);

        this.tweens.add({
          targets: island.arrowText,
          y: island.arrowY + 15,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      } else if (status === "current") {
        const arrow = this.add
          .text(island.arrowX, island.arrowY, "⬇", {
            fontSize: "60px",
            color: "#FF8F00",
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setDepth(10);
        this.tweens.add({
          targets: arrow,
          y: island.arrowY + 15,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      zone.on("pointerdown", () => {
        if (isUnlocking && GameData.lastPhaseIndex < GameData.phaseIndex)
          return;

        if (status === "current" || status === "unlocking") {
          playSfx(SFX.type);
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("PhaseScene", { phaseIndex: island.id });
          });
        } else if (status === "completed") {
          playSfx(SFX.type);
          this.showFeedbackMessage(
            island.x,
            island.y - 40,
            "✅ Fase já concluída!",
            "#2E7D32",
          );
        } else {
          playSfx(SFX.locked);
          this.showFeedbackMessage(
            island.x,
            island.y - 40,
            "🔒 Ilha Bloqueada! Complete a anterior.",
            "#D32F2F",
          );

          if (island.lockedImg && !this.tweens.isTweening(island.lockedImg)) {
            this.tweens.add({
              targets: island.lockedImg,
              angle: { from: -15, to: 15 },
              duration: 50,
              yoyo: true,
              repeat: 4,
              onComplete: () => {
                island.lockedImg.setAngle(0);
              },
            });
          }
        }
      });
    });

    const dispararNarrador = () => {
      let textoNarrador = "";
      if (GameData.phaseIndex === 0)
        textoNarrador = `Olá, ${GameData.playerName}! Me chamo Lúcia Pereira, vou te guiar e ajudar em toda a sua jornada. Clique na primeira ilha desbloqueada para iniciar!`;
      else if (GameData.phaseIndex === 1)
        textoNarrador =
          "Muito bem! Você concluiu a primeira etapa. A Trilha Digital já está disponível para o próximo desafio.";
      else if (GameData.phaseIndex === 2)
        textoNarrador =
          "Excelente progresso! A última etapa, Acelerador Digital, está liberada. Vamos lá!";

      if (textoNarrador !== "") {
        chamarNarrador(
          this,
          {
            idle: "narrador_idle",
            talkOpen: "narrador_talk_open",
            talkMid: "narrador_talk_mid",
            blink: "narrador_blink",
          },
          null,
          textoNarrador,
        );
      }
    };

    if (isUnlocking && targetIslandObj) {
      const startIsland = islands[GameData.lastPhaseIndex];

      // Barco com tamanho corrigido (setScale 0.15)
      const barco = this.add
        .image(startIsland.x, startIsland.y, "icon_boat")
        .setDepth(15)
        .setScale(0.1);

      this.tweens.add({
        targets: barco,
        x: targetIslandObj.x,
        y: targetIslandObj.y,
        duration: 2500,
        ease: "Sine.easeInOut",
        onComplete: () => {
          barco.destroy();

          if (targetIslandObj.padlockImg) {
            playSfx(SFX.unlock);
            this.tweens.add({
              targets: targetIslandObj.padlockImg,
              angle: { from: -20, to: 20 },
              duration: 50,
              yoyo: true,
              repeat: 5,
              onComplete: () => {
                this.tweens.add({
                  targets: targetIslandObj.padlockImg,
                  scale: 0.2,
                  alpha: 0,
                  duration: 300,
                  onComplete: () => {
                    targetIslandObj.padlockImg.destroy();
                    targetIslandObj.arrowText.setVisible(true);
                    GameData.lastPhaseIndex = GameData.phaseIndex;
                    dispararNarrador();
                  },
                });
              },
            });
          }
        },
      });
    } else {
      dispararNarrador();
    }
  }

  criarPlacaArredondada(x, y, texto, corFundo, corTexto) {
    const label = this.add
      .text(x, y, texto, {
        fontSize: "18px",
        fontStyle: "bold",
        color: corTexto,
      })
      .setOrigin(0.5)
      .setDepth(6);
    const bg = this.add.graphics().setDepth(5);
    bg.fillStyle(corFundo, 1);
    bg.fillRoundedRect(
      x - label.width / 2 - 12,
      y - label.height / 2 - 6,
      label.width + 24,
      label.height + 12,
      8,
    );
  }

  drawDottedLine(graphics, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let currentDist = 0;
    while (currentDist < dist) {
      const startX = x1 + (dx * currentDist) / dist;
      const startY = y1 + (dy * currentDist) / dist;
      const endDist = Math.min(currentDist + 10, dist);
      const endX = x1 + (dx * endDist) / dist;
      const endY = y1 + (dy * endDist) / dist;
      graphics.lineBetween(startX, startY, endX, endY);
      currentDist += 18;
    }
  }

  showFeedbackMessage(x, y, text, color) {
    if (this.isShowingMessage) return;
    this.isShowingMessage = true;

    const safeX = Phaser.Math.Clamp(x, 220, 740);

    const msg = this.add
      .text(safeX, y, text, {
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: color,
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(20);

    this.tweens.add({
      targets: msg,
      y: y - 20,
      alpha: 1,
      duration: 300,
      ease: "Power2",
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          this.tweens.add({
            targets: msg,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              msg.destroy();
              this.isShowingMessage = false;
            },
          });
        });
      },
    });
  }
}

class PhaseScene extends Phaser.Scene {
  constructor() {
    super("PhaseScene");
  }

  init(data) {
    this.phaseIndex = data.phaseIndex || 0;
    this.config = PHASES[this.phaseIndex];
  }

  preload() {
    buildAllTextures(this);

    const cfg = this.config;
    const bgKey = `bg_${cfg.id}`; // chave única por fase (fase1, fase2, fase3), evita conflito de cache
    if (!this.textures.exists(bgKey)) {
      this.load.image(bgKey, `assets/backgrounds/${cfg.bg}`);
    }

    const hasBoss = cfg.hasBoss !== false && cfg.boss;
    if (hasBoss && cfg.boss.portrait) {
      const idleKey = `boss_${cfg.id}_idle`;
      const talkKey = `boss_${cfg.id}_talk`;
      const blinkKey = `boss_${cfg.id}_blink`;

      if (!this.textures.exists(idleKey)) {
        this.load.image(idleKey, `assets/bosses/${cfg.boss.portrait.idle}`);
        if (cfg.boss.portrait.talk)
          this.load.image(talkKey, `assets/bosses/${cfg.boss.portrait.talk}`);
        if (cfg.boss.portrait.blink)
          this.load.image(blinkKey, `assets/bosses/${cfg.boss.portrait.blink}`);
      }
    }

    const charId = GameData.selectedCharacter;
    if (!this.textures.exists(`char_${charId}_idle`)) {
      this.load.spritesheet(
        `char_${charId}_idle`,
        `assets/characters/${charId}/Idle.png`,
        {
          frameWidth: CHARACTER_FRAME_SIZE,
          frameHeight: CHARACTER_FRAME_SIZE,
        },
      );
      this.load.spritesheet(
        `char_${charId}_walk`,
        `assets/characters/${charId}/Walk.png`,
        {
          frameWidth: CHARACTER_FRAME_SIZE,
          frameHeight: CHARACTER_FRAME_SIZE,
        },
      );
    }
  }

  create() {
    document.getElementById("hud").style.display = "flex";
    document.getElementById("touch-controls").style.display = "flex";
    // Mostra o HUD e os botões de movimento ao entrar na fase
    const hud = document.getElementById("hud");
    if (hud) hud.style.display = "flex"; // ou "block", dependendo do seu CSS

    const btnLeft = document.getElementById("btn-left");
    if (btnLeft) btnLeft.style.display = "flex";

    const btnRight = document.getElementById("btn-right");
    if (btnRight) btnRight.style.display = "flex";

    activeInfoId = null;
    clearInterval(infoTypeInterval);
    infoTypeInterval = null;

    const infoBubble = document.getElementById("info-bubble");

    infoBubble.classList.remove("hidden", "info-bubble-opening");

    infoBubble.classList.add("info-bubble-hidden");

    infoBubble.querySelector(".info-bubble-content").textContent = "";

    const cfg = this.config;
    this.cameras.main.setBackgroundColor(cfg.skyColor);
    this.physics.world.setBounds(0, 0, cfg.levelWidth, 540);
    this.cameras.main.setBounds(0, 0, cfg.levelWidth, 540);

    // Fundo: imagem real do escritório/ambiente desta fase, repetida (tile) ao longo da largura
    const bgKey = `bg_${cfg.id}`;
    const bgTex = this.textures.get(bgKey).getSourceImage();
    const bgScale = 540 / bgTex.height; // encaixa a altura da imagem na altura do jogo (540px)
    const bg = this.add.tileSprite(
      cfg.levelWidth / 2,
      270,
      cfg.levelWidth,
      540,
      bgKey,
    );
    bg.setTileScale(bgScale, bgScale);
    bg.setScrollFactor(1);

    // Chão (invisível — a própria imagem de fundo já mostra o piso; mantém só a física)
    this.groundGroup = this.physics.add.staticGroup();
    for (let x = 0; x < cfg.levelWidth; x += 64) {
      this.groundGroup
        .create(x + 32, 500, "ground")
        .setVisible(false)
        .refreshBody();
    }

    // Player (sprite real — CraftPix City Men)
    const charId = GameData.selectedCharacter;
    const charDef = CHARACTERS.find((c) => c.id === charId);

    if (!this.anims.exists(`${charId}_idle`)) {
      this.anims.create({
        key: `${charId}_idle`,
        frames: this.anims.generateFrameNumbers(`char_${charId}_idle`, {
          start: 0,
          end: charDef.idleFrames - 1,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }
    if (!this.anims.exists(`${charId}_walk`)) {
      this.anims.create({
        key: `${charId}_walk`,
        frames: this.anims.generateFrameNumbers(`char_${charId}_walk`, {
          start: 0,
          end: charDef.walkFrames - 1,
        }),
        frameRate: 12,
        repeat: -1,
      });
    }

    // groundY = onde os pés encostam nesta fase; characterScale = tamanho do personagem nesta fase
    // (cada uma tem fallback pro padrão, então é opcional definir por fase)
    const groundY = cfg.groundY ?? 460;
    const charScale = cfg.characterScale ?? CHARACTER_SCALE;
    const startX = cfg.startX ?? 80;
    const startDirection = cfg.startDirection ?? "right";

    this.player = this.physics.add.sprite(
      startX,
      groundY,
      `char_${charId}_idle`,
      0,
    );

    this.player.setOrigin(0.5, 1);
    this.player.body.setAllowGravity(false);
    this.player.setSize(CHARACTER_BODY.width, CHARACTER_BODY.height);
    this.player.body.setOffset(CHARACTER_BODY.offsetX, CHARACTER_BODY.offsetY);

    this.player.setScale(charScale);
    this.player.setFlipX(startDirection === "left");
    this.player.setCollideWorldBounds(true);
    this.player.setDragX(900);
    this.player.setMaxVelocity(220, 0);
    this.player.anims.play(`${charId}_idle`);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Murais/quadros na parede (posição real do mundo — igual ao cálculo de proximidade)
    this.infoIcons = [];

    this.usedOnceSpots = new Set(); // controla murais de uso único (ex: fase 2 — não reaparecem depois de vistos)

    cfg.infoSpots.forEach((spot, index) => {
      const icon = this.add
        .image(spot.x, spot.y ?? 300, "posterTex")
        .setOrigin(0.5, 1)
        .setDepth(20)
        .setAlpha(0.75);

      this.tweens.add({
        targets: icon, // <- corrigido
        y: icon.y - 4,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      this.infoIcons.push(icon);
    });
    this.infoSpots = cfg.infoSpots;

    // Boss no fim da fase (posição vem da config da fase — ver bossX/bossY em PHASES)
    const doorX = cfg.doorX;
    const hasBoss = cfg.hasBoss !== false && cfg.boss;

    this.bossTriggered = false;

    if (hasBoss) {
      const bossX = cfg.bossX;
      const bossY = cfg.bossY;

      if (cfg.boss.portrait) {
        const idleKey = `boss_${cfg.id}_idle`;
        const talkKey = `boss_${cfg.id}_talk`;
        const blinkKey = `boss_${cfg.id}_blink`;
        const portraitHeight = cfg.boss.portraitHeight ?? 260;
        const flip = cfg.boss.portraitFlip === true;

        const idleTex = this.textures.get(idleKey).getSourceImage();
        const talkTex = this.textures.exists(talkKey)
          ? this.textures.get(talkKey).getSourceImage()
          : idleTex;
        const hasBlink = this.textures.exists(blinkKey);
        const blinkTex = hasBlink
          ? this.textures.get(blinkKey).getSourceImage()
          : idleTex;

        const idleBaseScale = portraitHeight / idleTex.height;
        const talkBaseScale = portraitHeight / talkTex.height;
        const blinkBaseScale = portraitHeight / blinkTex.height;

        this.bossIdleSprite = this.add
          .image(bossX, bossY, idleKey)
          .setOrigin(0.5, 1)
          .setScale(idleBaseScale)
          .setFlipX(flip);
        this.bossTalkSprite = this.add
          .image(bossX, bossY, talkKey)
          .setOrigin(0.5, 1)
          .setScale(talkBaseScale)
          .setFlipX(flip)
          .setVisible(false);
        this.bossBlinkSprite = this.add
          .image(bossX, bossY, hasBlink ? blinkKey : idleKey)
          .setOrigin(0.5, 1)
          .setScale(blinkBaseScale)
          .setFlipX(flip)
          .setVisible(false);

        this.bossSprite = this.bossIdleSprite;

        // Respiração sutil para os 3 sprites
        const addBreathingTween = (targetSprite, baseScale) => {
          this.tweens.add({
            targets: targetSprite,
            scaleY: baseScale * 1.02,
            scaleX: baseScale * 0.995,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        };
        addBreathingTween(this.bossIdleSprite, idleBaseScale);
        addBreathingTween(this.bossTalkSprite, talkBaseScale);
        addBreathingTween(this.bossBlinkSprite, blinkBaseScale);

        this.bossTalkInterval = null;

        // Lógica orgânica de piscar
        this.bossBlinkInterval = setInterval(() => {
          // Só pisca se houver frame, não estiver pausado e não estiver falando
          if (!hasBlink || GameData.menuPaused || this.bossTalkInterval) return;

          // 30% de chance de piscar a cada ciclo para não ficar robótico
          if (Math.random() > 0.3) return;

          this.bossIdleSprite.setVisible(false);
          this.bossBlinkSprite.setVisible(true);

          setTimeout(() => {
            // Checa novamente antes de voltar ao normal (caso tenha pausado ou começado a falar nesse meio segundo)
            if (!this.bossTalkInterval) {
              this.bossBlinkSprite.setVisible(false);
              this.bossIdleSprite.setVisible(true);
            }
          }, 150); // Duração do olho fechado (150ms)
        }, 2200);

        this.startBossTalkAnim = () => {
          if (this.bossTalkInterval) return;
          this.bossBlinkSprite.setVisible(false); // Garante que o blink desliga ao falar

          this.bossTalkInterval = setInterval(() => {
            if (GameData.menuPaused) return;
            const showTalk = !this.bossTalkSprite.visible;
            this.bossTalkSprite.setVisible(showTalk);
            this.bossIdleSprite.setVisible(!showTalk);
          }, 160);
        };

        this.stopBossTalkAnim = () => {
          clearInterval(this.bossTalkInterval);
          this.bossTalkInterval = null;
          this.bossTalkSprite.setVisible(false);
          this.bossBlinkSprite.setVisible(false);
          this.bossIdleSprite.setVisible(true);
        };
      } else {
        this.bossSprite = this.add
          .image(bossX, bossY, "bossTex")
          .setOrigin(0.5, 1);
      }

      this.bossZone = this.add.zone(bossX, bossY, 70, 100);

      this.physics.add.existing(this.bossZone, true);

      this.physics.add.overlap(this.player, this.bossZone, () => {
        if (!this.bossTriggered && !GameData.paused) {
          this.bossTriggered = true;
          this.player.setVelocity(0, 0);

          startBossBattle(this, cfg, this.bossSprite, () =>
            this.onBossDefeated(),
          );
        }
      });
    }

    // Saída — seta dourada, só existe se a fase tiver uma (fase final não tem)
    if (cfg.showExitArrow !== false) {
      const exitY = groundY;
      const arrowPointsLeft = (cfg.exitDirection || "forward") === "backward";

      const exitStartsOpen = cfg.exitInitiallyOpen === true;

      this.doorGlow = this.add
        .circle(doorX, exitY - 90, 46, THEME.accent, 0.25)
        .setVisible(exitStartsOpen);

      this.door = this.add
        .text(doorX, exitY - 90, "➜", {
          fontSize: "64px",
          fontStyle: "bold",
          color: "#f2a900",
        })
        .setOrigin(0.5)
        .setFlipX(arrowPointsLeft)
        .setVisible(exitStartsOpen);

      this.tweens.add({
        targets: this.doorGlow,
        scale: {
          from: 0.85,
          to: 1.15,
        },
        alpha: {
          from: 0.15,
          to: 0.35,
        },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      this.tweens.add({
        targets: this.door,
        x: doorX + (arrowPointsLeft ? -12 : 12),
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      this.doorX = doorX;
      this.doorTriggerRadius = 70;
      this.doorOpen = exitStartsOpen;
    } else {
      this.doorOpen = false;
    }

    this.phaseTransitioning = false; // trava pra não disparar a troca de fase várias vezes seguidas

    // Sistema de input
    this.inputManager = new InputManager(this);

    this.levelWidth = cfg.levelWidth;

    updateHUD();
    updateMuraisCounter(cfg.id, cfg.infoSpots.length);

    // Bloqueia o personagem durante o título
    this.inputManager.setEnabled(false);

    // Apresentação do capítulo e chamada automática do Narrador para as fases 1, 2 e 3
    showPhaseIntro(cfg, () => {
      // Mensagens personalizadas do Narrador para o início de cada fase
      let textoNarrador = null;

      if (cfg.id === "fase1") {
        // Pausa completamente o jogo para a introdução em partes da Fase 1
        GameData.paused = true;
        this.physics.pause();
        this.inputManager.setEnabled(false);

        // Parte 1: Boas-vindas
        chamarNarrador(
          this,
          {
            idle: "narrador_idle",
            talkOpen: "narrador_talk_open",
            talkMid: "narrador_talk_mid",
            blink: "narrador_blink",
          },
          null,
          "Olá! Seja bem-vindo à fase de boas-vindas.",
          () => {
            // Parte 2: Sobre a FINECAP
            chamarNarrador(
              this,
              {
                idle: "narrador_idle",
                talkOpen: "narrador_talk_open",
                talkMid: "narrador_talk_mid",
                blink: "narrador_blink",
              },
              null,
              "O evento FINECAP acontece todo ano em Pau dos Ferros, reunindo negócios, cultura e inovação de toda a região.",
              () => {
                // Parte 3: Sobre o Sebrae
                chamarNarrador(
                  this,
                  {
                    idle: "narrador_idle",
                    talkOpen: "narrador_talk_open",
                    talkMid: "narrador_talk_mid",
                    blink: "narrador_blink",
                  },
                  null,
                  "E o Sebrae atua fortemente oferecendo suporte e fortalecimento para as pequenas empresas. Vamos começar!",
                  () => {
                    // Retoma o jogo após o fim da terceira parte da Fase 1
                    GameData.paused = false;
                    this.physics.resume();
                    this.inputManager.setEnabled(true);
                  },
                );
              },
            );
          },
        );
      } else if (cfg.id === "fase2") {
        // Pausa completamente o jogo para a introdução em 2 partes da Fase 2
        GameData.paused = true;
        this.physics.pause();
        this.inputManager.setEnabled(false);

        // Parte 1: Início da Trilha Digital
        chamarNarrador(
          this,
          {
            idle: "narrador_idle",
            talkOpen: "narrador_talk_open",
            talkMid: "narrador_talk_mid",
            blink: "narrador_blink",
          },
          null,
          "Muito bem! Agora entramos na etapa de Presença Digital. Hoje, o cliente procura sua empresa na palma da mão antes de comprar.",
          () => {
            // Parte 2: Conceitos
            chamarNarrador(
              this,
              {
                idle: "narrador_idle",
                talkOpen: "narrador_talk_open",
                talkMid: "narrador_talk_mid",
                blink: "narrador_blink",
              },
              null,
              "Fique atento aos murais: vamos entender como ser achado no Google, Como utilizar o WhatsApp para Negócios e como usar a IA a seu favor!",
              () => {
                // Retoma o jogo após o fim da segunda parte da Fase 2
                GameData.paused = false;
                this.physics.resume();
                this.inputManager.setEnabled(true);
              },
            );
          },
        );
      } else {
        // Fluxo padrão para a fase 3 e futuras
        let textoNarrador = null;

        if (cfg.id === "fase3") {
          textoNarrador =
            "Chegamos ao desafio final: Aqui você colocará a prova seus conhecimentos sobre tráfego pago, Inteligência Artificial e WhatsApp para Negócios.";
        } 

        if (textoNarrador) {
          GameData.paused = true;
          this.physics.pause();
          this.inputManager.setEnabled(false);

          chamarNarrador(
            this,
            {
              idle: "narrador_idle",
              talkOpen: "narrador_talk_open",
              talkMid: "narrador_talk_mid",
              blink: "narrador_blink",
            },
            null,
            textoNarrador,
            () => {
              GameData.paused = false;
              this.physics.resume();
              this.inputManager.setEnabled(true);
            },
          );
        } else if (cfg.narrative?.length) {
          startNarrative(this, cfg.narrative);
        } else {
          this.inputManager.setEnabled(true);
        }
      }
    });
  }

  onBossDefeated() {
    if (this.config.showExitArrow === false) {
      // Em vez de sair na mesma hora, aguarda 3 segundos (3000 ms)
      this.time.delayedCall(1500, () => {
        this.goToNextPhase();
      });
      return;
    }
    // Para as fases 2 e 3, a porta/seta aparece normalmente
    this.doorOpen = true;
    this.door.setVisible(true);
    this.doorGlow.setVisible(true);
  }

  goToNextPhase() {
    const next = this.phaseIndex + 1;
    if (next >= PHASES.length) {
      endGame(true); // Terminou tudo
    } else {
      // NOVO: Guarda de qual fase viemos para o barco saber de onde sair no Mapa
      GameData.lastPhaseIndex = this.phaseIndex;
      GameData.phaseIndex = next;
      updateHUD();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("MapScene");
      });
    }
  }

  update() {
    // Mural por proximidade — nunca pausa o jogo
    updateInfoBubble(
      this,
      this.player.x,
      this.infoSpots,
      this.config.id,
      this.infoIcons,
    );

    if (GameData.paused) {
      this.player.setVelocityX(0);
      const idleAnim = `${GameData.selectedCharacter}_idle`;
      if (this.player.anims.currentAnim?.key !== idleAnim) {
        this.player.anims.play(idleAnim, true);
      }
      return;
    }
    // Saída da fase — dispara quando o jogador chega perto da seta (só depois do boss cair)
    if (this.doorOpen && !this.phaseTransitioning && this.doorX !== undefined) {
      if (Math.abs(this.player.x - this.doorX) < this.doorTriggerRadius) {
        this.phaseTransitioning = true;
        this.goToNextPhase();
      }
    }

    if (!this.inputManager.enabled) {
      this.player.setVelocityX(0);

      const idleAnim = `${GameData.selectedCharacter}_idle`;

      if (this.player.anims.currentAnim?.key !== idleAnim) {
        this.player.anims.play(idleAnim, true);
      }

      return;
    }

    const charId = GameData.selectedCharacter;
    const left = this.inputManager.left();
    const right = this.inputManager.right();

    let vx = 0;
    if (left) {
      vx = -160;
      this.player.setFlipX(true);
    }
    if (right) {
      vx = 160;
      this.player.setFlipX(false);
    }
    this.player.setVelocityX(vx);

    const desiredAnim = vx !== 0 ? `${charId}_walk` : `${charId}_idle`;
    if (this.player.anims.currentAnim?.key !== desiredAnim) {
      this.player.anims.play(desiredAnim, true);
    }
  }
}

// ---------------------------------------------------------
// CONFIGURAÇÃO DO PHASER
// ---------------------------------------------------------
const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 960,
  height: 540,
  pixelArt: true, // mantém os pixels nítidos ao escalar
  backgroundColor: "#000000",
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 1200 }, debug: false },
  },
  scene: [], // NÃO registrar PhaseScene aqui — evitaria autostart e capturaria o teclado antes da hora
};

const game = new Phaser.Game(config);
// Registrado manualmente, mas com autostart desligado (3º argumento = false).
// A cena só é iniciada de fato quando o jogador confirma o nome e clica em "Jogar".

// ---------------------------------------------------------
// TELA CHEIA RESPONSIVA
// O jogo roda internamente sempre em 960x540 (mesma resolução de sempre,
// então nada da lógica/posicionamento muda). O #game-wrapper inteiro
// (canvas + HUD + caixas de diálogo) é escalado via CSS transform pra
// preencher a tela do usuário, mantendo a proporção 16:9.
// ---------------------------------------------------------
function fitGameToScreen() {
  const wrapper = document.getElementById("game-wrapper");
  if (!wrapper) return;
  const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540);
  wrapper.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener("resize", fitGameToScreen);
fitGameToScreen();
game.scene.add("MapScene", MapScene, false);
game.scene.add("PhaseScene", PhaseScene, false);

// ---------------------------------------------------------
// MENU INICIAL — navegação entre sub-telas (Jogar/Ranking/Regras/Sobre/Criador)
// ---------------------------------------------------------
function showPanel(id) {
  document
    .querySelectorAll(".menu-panel")
    .forEach((p) => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  if (id === "panel-ranking") renderRankingInto("ranking-list-menu");
}

document
  .querySelectorAll(".menu-btn[data-target], .back-btn[data-target]")
  .forEach((btn) => {
    btn.addEventListener("click", () => showPanel(btn.dataset.target));
  });

const nameInput = document.getElementById("player-name-start");
const nameWarning = document.getElementById("name-warning");

document.querySelectorAll(".character-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".character-option")
      .forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    GameData.selectedCharacter = btn.dataset.character;
    document.getElementById("hud-character-icon").src =
      `assets/thumbnails/${GameData.selectedCharacter}.png`;
  });
});

document.getElementById("confirm-name-btn").addEventListener("click", () => {
  const name = nameInput.value.trim();

  if (!name) {
    nameWarning.textContent = "Digite seu nome antes de começar 🙂";
    nameWarning.classList.remove("hidden");
    nameInput.focus();
    return;
  }

  const nameTaken = loadRanking().some(
    (r) => r.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (nameTaken) {
    nameWarning.textContent =
      "Esse nome já está no ranking! Escolha outro (ex: adicione um sobrenome).";
    nameWarning.classList.remove("hidden");
    nameInput.focus();
    return;
  }

  // só chega aqui se o nome for válido e único
  nameWarning.classList.add("hidden");
  startBgm();
  GameData.playerName = name;
  resetGameData();
  updateHUD();

  // Exibe os controles de toque ao sair do menu inicial
  document.getElementById("touch-controls").style.display = "flex";

  document.getElementById("start-overlay").classList.add("hidden");
  game.scene.start("MapScene");
});

// Função para ajustar o volume globalmente
function setGlobalVolume(val) {
  const v = Math.max(0, Math.min(1, val));

  // Altera apenas o volume da música de fundo (multiplicado pelo volume base dela que é 0.2)
  SFX.bgm.volume = v * 0.2;

  // Os efeitos sonoros (SFX.type, SFX.tick, etc.) mantêm seus valores originais fixos e intocados.

  const label = document.getElementById("volume-label");
  if (label) label.textContent = `${Math.round(v * 100)}%`;
}

// Eventos da Barra de Volume
const volumeBtn = document.getElementById("volume-btn");
const volumePopup = document.getElementById("volume-popup");
const volumeSlider = document.getElementById("volume-slider");

if (volumeSlider) {
  volumeSlider.value = "1";
}
setGlobalVolume(1);

volumeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  volumePopup.classList.toggle("hidden");
});

volumeSlider.addEventListener("input", (e) => {
  setGlobalVolume(parseFloat(e.target.value));
});

// Fecha o pop-up se clicar fora
document.addEventListener("click", (e) => {
  if (!volumePopup.contains(e.target) && e.target !== volumeBtn) {
    volumePopup.classList.add("hidden");
  }
});

// Eventos do Botão e Modal de Pause
const pauseBtn = document.getElementById("pause-btn");
const pauseModal = document.getElementById("pause-modal");

pauseBtn.addEventListener("click", () => {
  GameData.paused = true;
  pauseModal.classList.remove("hidden");

  // O jeito nativo e correto de congelar o Phaser (para física, update, inputs e animações)
  game.scene.scenes.forEach((scene) => {
    if (scene.scene.isActive()) {
      scene.scene.pause();
    }
  });
});

document.getElementById("resume-btn").addEventListener("click", () => {
  GameData.paused = false;
  pauseModal.classList.add("hidden");

  // Retoma o funcionamento do motor do Phaser
  game.scene.scenes.forEach((scene) => {
    if (scene.scene.isPaused()) {
      scene.scene.resume();
    }
  });
});

// =========================================================
// EVENTOS DA TELA DE GAME OVER E RANKING
// =========================================================
const viewRankingBtn = document.getElementById("view-ranking-btn");
const restartBtn = document.getElementById("restart-btn");
const closeRankingBtn = document.getElementById("close-ranking-btn");
const rankingOverlay = document.getElementById("ranking-overlay");
const endOverlay = document.getElementById("end-overlay");

// 1. Abrir o ranking por cima da tela de Game Over
if (viewRankingBtn) {
  viewRankingBtn.addEventListener("click", () => {
    rankingOverlay.classList.remove("hidden");
    // Renderiza a lista na div específica do modal de fim de jogo
    renderRankingInto("ranking-list-content");
  });
}

// 2. Fechar o modal de ranking e voltar para a tela de Game Over
if (closeRankingBtn) {
  closeRankingBtn.addEventListener("click", () => {
    rankingOverlay.classList.add("hidden");
  });
}

// 3. Reiniciar a partida
if (restartBtn) {
  restartBtn.addEventListener("click", () => {
    endOverlay.classList.add("hidden");
    rankingOverlay.classList.add("hidden");
    document.getElementById("boss-overlay").classList.add("hidden");
    document.getElementById("info-bubble").classList.add("info-bubble-hidden");
    document.getElementById("qrcode-modal")?.classList.add("hidden");

    stopSfx(SFX.bgm);

    resetGameData();

    document.getElementById("hud").style.display = "none";
    document.getElementById("touch-controls").style.display = "none";

    game.scene.scenes.forEach((scene) => {
      if (scene.input && scene.input.keyboard) {
        scene.input.keyboard.clearCaptures();
      }
    });
    game.scene.stop("PhaseScene");
    game.scene.stop("MapScene");

    document.getElementById("start-overlay").classList.remove("hidden");
    showPanel("panel-menu");

    const nameInput = document.getElementById("player-name-start");
    if (nameInput) nameInput.value = "";

    const nameWarning = document.getElementById("name-warning");
    if (nameWarning) nameWarning.classList.add("hidden");
  });
}

function showQRCodeModal(qrConfig, onDone) {
  const modal = document.getElementById("qrcode-modal");
  const img = document.getElementById("qrcode-img");
  const timerSpan = document.getElementById("qrcode-timer");
  const closeBtn = document.getElementById("qrcode-close-btn");
  const titleEl = document.getElementById("qrcode-title");
  const textEl = document.getElementById("qrcode-text");

  if (!modal || !img) {
    if (onDone) onDone();
    return;
  }

  // Preenche a imagem, título e texto (se existirem na configuração)
  if (qrConfig.image) img.src = qrConfig.image;
  if (qrConfig.title && titleEl) titleEl.textContent = qrConfig.title;
  if (qrConfig.text && textEl) textEl.textContent = qrConfig.text;

  let timeLeft = qrConfig.duration || 30;
  timerSpan.textContent = timeLeft;
  modal.classList.remove("hidden");

  let qrInterval = null;

  const cleanup = () => {
    clearInterval(qrInterval);
    modal.classList.add("hidden");
    closeBtn.onclick = null;
    if (onDone) onDone();
  };

  closeBtn.onclick = () => {
    cleanup();
  };

  qrInterval = setInterval(() => {
    timeLeft -= 1;
    timerSpan.textContent = timeLeft;
    if (timeLeft <= 0) {
      cleanup();
    }
  }, 1000);
}
