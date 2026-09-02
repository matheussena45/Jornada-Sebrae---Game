// =========================================================
// EMPRESÁRIO EM AÇÃO — protótipo jogável
//
// COMO PERSONALIZAR:
//  - Cores da marca: editar THEME (abaixo) + :root em style.css (manter os dois sincronizados)
//  - Personagens jogáveis: editar CHARACTERS (abaixo) + arquivos em assets/characters/<id>/
//  - Fases, murais e perguntas: editar PHASES
//  - Textos "Sobre o escritório" / "Sobre o criador": editar diretamente no index.html
// =========================================================

const RANKING_KEY = "empresario_ranking_v1";
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
};
SFX.bgm.loop = true;
SFX.bgm.volume = 0.2; // volume moderado — não briga com os efeitos
SFX.type.volume = 0.03;
SFX.tick.volume = 1.0;
SFX.tick.loop = false;

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
}

// ---------------------------------------------------------
// CONTEÚDO DAS FASES
// ---------------------------------------------------------
const PHASES = [
  {
    id: "fase1",
    name: "Abrindo sua Empresa",
    startX: 80,
    startDirection: "right",
    hasBoss: true,
    exitInitiallyOpen: false,
    phaseNumber: 1,
    phaseLabel: "Fase 1",
    skyColor: 0x18233d,
    groundColor: 0x2c3350,
    decorColor: 0x22304f,
    levelWidth: 1990,
    bg: "street_bg.png",
    bossX: 1750,
    bossY: 478,
    doorX: 1770,
    groundY: 480,
    showExitArrow: true,
    exitDirection: "forward", // seta aponta pra frente
    characterScale: 1.8,
    infoSpots: [
      {
        x: 440,
        y: 340,
        text: "Se você está começando um negócio, lembre-se: organizar tudo desde o início evita muita dor de cabeça no futuro.",
      },
      {
        x: 820,
        y: 320,
        text: "Muita gente acha que abrir uma empresa é só conseguir um CNPJ, mas existem outras responsabilidades importantes.",
      },
      {
        x: 1300,
        y: 320,
        text: "Cada decisão tomada no início da empresa pode fazer diferença lá na frente. Vale a pena conhecer bem cada etapa.",
      },
    ],
    boss: {
      name: "Analista do Sebrae",
      portrait: { idle: "boss1_idle.png", talk: "boss1_talk.png" },
      portraitHeight: 130, // corpo inteiro — maior que os outros dois (retrato busto)
      portraitFlip: true,
      greeting:
        "Olá! Me chamo Franciel Monte, sou o Analista do Sebrae. Antes de você seguir sua jornada, vou ver o que você já aprendeu sobre abrir uma empresa!",
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
        {
          q: "Para que serve o CNPJ?",
          options: [
            "Identifica oficialmente a empresa perante o governo",
            "Identifica a principal conta bancária da empresa",
            "Comprova a qualidade dos serviços da empresa",
            "Substitui o CPF do proprietário da empresa",
          ],
          correct: 0,
          explanation:
            "O CNPJ funciona como a identidade da empresa. É por meio dele que ela existe oficialmente e pode exercer suas atividades de forma legal.",
        },

        {
          q: "O que é o MEI?",
          options: [
            "Uma linha de crédito para empreendedores",
            "Uma forma simples de formalizar pequenos negócios",
            "Um imposto destinado às grandes empresas",
            "Um curso obrigatório para abrir empresas",
          ],
          correct: 1,
          explanation:
            "O MEI facilita a formalização de pequenos empreendedores, permitindo atuar legalmente com menos burocracia e menor custo.",
        },

        {
          q: "Empresa formalizada deve:",
          options: [
            "Ficar isenta de todos os impostos",
            "Emitir notas fiscais e pagar impostos",
            "Deixar de prestar informações ao governo",
            "Contratar funcionários imediatamente",
          ],
          correct: 1,
          explanation:
            "Ao formalizar a empresa, ela passa a ter direitos, como emitir nota fiscal, mas também assume obrigações fiscais.",
        },

        {
          q: "Razão social é:",
          options: [
            "O nome usado nas redes sociais",
            "O nome oficial registrado da empresa",
            "O endereço principal da empresa",
            "O valor investido pelos sócios",
          ],
          correct: 1,
          explanation:
            "A razão social é o nome registrado nos documentos oficiais. Ela pode ser diferente do nome fantasia usado pelos clientes.",
        },

        {
          q: "Para abrir conta PJ é preciso:",
          options: [
            "CPF e comprovante de residência",
            "CNPJ e documentos da empresa",
            "Comprovante de faturamento anual",
            "Autorização emitida pelo contador",
          ],
          correct: 1,
          explanation:
            "Os bancos precisam confirmar que a empresa existe legalmente, por isso exigem o CNPJ e seus documentos.",
        },

        {
          q: "Por que contratar contador?",
          options: [
            "Atender somente empresas de grande porte",
            "Cuidar das obrigações fiscais e contábeis",
            "Realizar as vendas da empresa",
            "Assumir a administração do negócio",
          ],
          correct: 1,
          explanation:
            "O contador ajuda a empresa a cumprir suas obrigações legais, organizar as finanças e evitar problemas com o Fisco.",
        },

        {
          q: "Regime tributário é:",
          options: [
            "O horário de funcionamento da empresa",
            "As regras para calcular os impostos",
            "O tipo de produto comercializado",
            "A quantidade máxima de sócios",
          ],
          correct: 1,
          explanation:
            "O regime tributário define como os impostos serão calculados e pagos pela empresa, de acordo com a legislação.",
        },

        {
          q: "Por que guardar notas fiscais?",
          options: [
            "Porque elas não podem ser descartadas",
            "Para comprovar despesas e organizar a empresa",
            "Para decorar o arquivo da empresa",
            "Para trocar produtos comprados",
          ],
          correct: 1,
          explanation:
            "As notas fiscais ajudam no controle financeiro, comprovam despesas e podem ser exigidas em fiscalizações.",
        },

        {
          q: "Imposto não pago em dia gera:",
          options: [
            "Nenhuma consequência para a empresa",
            "Multas, juros e possíveis restrições",
            "Perdão automático após alguns dias",
            "Pagamento feito pelo contador",
          ],
          correct: 1,
          explanation:
            "O atraso no pagamento pode gerar multas, juros e outras restrições que prejudicam a empresa.",
        },

        {
          q: "Alvará de funcionamento é:",
          options: [
            "Autorização para funcionar no endereço",
            "Comprovante de inscrição no MEI",
            "Seguro obrigatório da empresa",
            "Contrato firmado entre os sócios",
          ],
          correct: 0,
          explanation:
            "O alvará é a autorização concedida pela prefeitura para que a empresa possa funcionar legalmente naquele local.",
        },
      ],
    },
  },
  {
    id: "fase2",
    name: "Organizando a Empresa",
    startX: 80,
    startDirection: "right",
    hasBoss: true,
    exitInitiallyOpen: false,
    objectiveHint: "⬅ Depois de falar com o gerente, volte e saia do Sebrae.",
    showExitArrow: true,
    exitDirection: "backward", // seta aponta pra trás (saindo da empresa)
    phaseNumber: 2,
    phaseLabel: "Fase 2",
    skyColor: 0x18233d,
    groundColor: 0x2c3350,
    decorColor: 0x22304f,
    levelWidth: 1990,
    bg: "agencia_bg.png",
    bossX: 1785,
    bossY: 292,
    doorX: 100,
    groundY: 400,
    characterScale: 2.2,
    infoSpots: [
      {
        x: 195,
        y: 235,
        text: "Olá! Seja muito bem-vindo ao Sebrae. Estamos felizes em ajudar você nessa nova etapa da sua empresa.",
        textAfterBoss: "Tchau! Foi um prazer te ajudar, volte sempre.",
      },
      {
        x: 700,
        y: 245,
        text: "Uma empresa organizada acompanha suas finanças e mantém seus documentos sempre em dia.",
        once: true,
      },
      {
        x: 1400,
        y: 255,
        text: "Controlar receitas, despesas e impostos ajuda o empresário a tomar decisões muito mais seguras.",
        once: true,
      },
    ],
    boss: {
      name: "Gerente do Sebrae",
      portrait: { idle: "boss2_idle.png", talk: "boss2_talk.png" },
      portraitHeight: 90,
      greeting:
        "Seja bem-vindo ao Sebrae RN. Sou Leonel Pontes e vou avaliar seus conhecimentos sobre organização financeira.",
      introLines: [
        "Vamos à primeira questão:",
        "Muito bem. Sigamos para a próxima:",
        "Última questão, atenção redobrada aqui:",
      ],
      correctLines: [
        "Correto. Você demonstra bom entendimento do assunto.",
        "Exatamente isso. Prossigamos.",
        "Resposta precisa. Muito bem.",
      ],
      wrongLines: [
        "Não é bem assim. Deixe-me esclarecer:",
        "Esse é um ponto que exige atenção. Veja bem:",
        "Vamos revisar esse conceito com calma:",
      ],
      resultMessages: {
        3: "Desempenho excelente. Você demonstrou domínio sólido sobre organização financeira e tributária.",
        2: "Bom resultado. Você já tem uma base sólida, mas ainda há pontos importantes para aprofundar.",
        1: "Você acertou parte dos conceitos, mas ainda vale revisar alguns pontos importantes para a gestão do seu negócio.",
        0: "Esses conceitos ainda precisam de mais atenção. Estudar um pouco mais fará toda a diferença na gestão da sua empresa.",
      },
      questions: [
        {
          q: "Para que serve a guia DAS?",
          options: [
            "Comprovar o pagamento dos impostos",
            "Aplicar multa por atraso",
            "Organizar documentos internos",
            "Servir apenas para grandes empresas",
          ],
          correct: 0,
          explanation:
            "No Simples Nacional, a DAS reúne vários impostos em uma única guia e comprova que eles foram pagos.",
        },

        {
          q: "Escolher o regime tributário:",
          options: [
            "Não altera os impostos da empresa",
            "Pode mudar quanto a empresa paga de impostos",
            "Só importa para empresas com prejuízo",
            "É uma decisão tomada pelo banco",
          ],
          correct: 1,
          explanation:
            "Cada regime possui regras diferentes. Escolher o mais adequado pode reduzir custos e evitar pagamentos desnecessários.",
        },

        {
          q: "O Balanço Patrimonial mostra:",
          options: [
            "As vendas realizadas no dia",
            "A situação financeira da empresa",
            "Somente dados para empréstimos",
            "As notas fiscais emitidas",
          ],
          correct: 1,
          explanation:
            "O Balanço Patrimonial apresenta os bens, as dívidas e o patrimônio da empresa em uma data específica.",
        },

        {
          q: "O que é o Simples Nacional?",
          options: [
            "Regime que facilita os impostos de pequenas empresas",
            "Aplicativo para pagar tributos",
            "Linha de crédito empresarial",
            "Regime exclusivo para grandes empresas",
          ],
          correct: 0,
          explanation:
            "O Simples Nacional simplifica o pagamento de impostos ao reunir diversos tributos em uma única guia.",
        },

        {
          q: "A declaração anual de faturamento serve para:",
          options: [
            "Conferir se os impostos estão corretos",
            "Substituir os pagamentos mensais",
            "Informar apenas empresas com prejuízo",
            "Cumprir uma formalidade sem efeitos",
          ],
          correct: 0,
          explanation:
            "Ela permite que o governo compare o faturamento informado com os impostos pagos pela empresa.",
        },

        {
          q: "Qual a diferença entre faturamento e lucro?",
          options: [
            "São exatamente a mesma coisa",
            "Faturamento é receita; lucro é o que sobra",
            "Faturamento é o dinheiro em caixa",
            "Lucro sempre é maior que o faturamento",
          ],
          correct: 1,
          explanation:
            "Faturamento é tudo o que a empresa recebe com vendas. Lucro é o valor restante após pagar todas as despesas.",
        },

        {
          q: "O que é a folha de pagamento?",
          options: [
            "Lista com os nomes dos funcionários",
            "Cálculo de salários e encargos",
            "Relatório das vendas da empresa",
            "Registro das compras realizadas",
          ],
          correct: 1,
          explanation:
            "A folha reúne salários, descontos, benefícios e encargos trabalhistas de todos os funcionários.",
        },

        {
          q: "O que é o pró-labore?",
          options: [
            "Imposto pago pelas empresas",
            "Remuneração do sócio pelo trabalho",
            "Distribuição anual dos lucros",
            "Taxa cobrada pela prefeitura",
          ],
          correct: 1,
          explanation:
            "O pró-labore é a remuneração do sócio que trabalha na empresa e é diferente da distribuição de lucros.",
        },

        {
          q: "O que mostra a DRE?",
          options: [
            "Se a empresa teve lucro ou prejuízo",
            "Os impostos pagos pela empresa",
            "Os bens e equipamentos da empresa",
            "Os documentos da abertura da empresa",
          ],
          correct: 0,
          explanation:
            "A DRE apresenta receitas, custos e despesas, mostrando o resultado financeiro de um período.",
        },

        {
          q: "Por que separar as finanças da empresa?",
          options: [
            "Não é necessário separar",
            "Para controlar melhor o negócio",
            "Porque a conta pessoal é proibida",
            "Apenas para organizar documentos",
          ],
          correct: 1,
          explanation:
            "Separar as contas facilita o controle financeiro, evita erros contábeis e ajuda a avaliar o desempenho da empresa.",
        },
      ],
    },
  },
  {
    id: "fasetransicao",
    name: "O Início de uma Nova Jornada",
    phaseNumber: 2,
    phaseLabel: "Interlúdio",
    objectiveHint: "⬅ Siga à esquerda até a próxima rua.",
    skyColor: 0x18233d,
    groundColor: 0x2c3350,
    decorColor: 0x22304f,
    levelWidth: 1990,
    bg: "street_bg.png",
    startX: 1790,
    startDirection: "left",
    hasBoss: false,
    exitInitiallyOpen: true,
    doorX: 90,
    groundY: 480,
    showExitArrow: true,
    exitDirection: "backward", // seta aponta pra trás (saindo da empresa)
    characterScale: 1.8,

    narrative: [
      {
        type: "narrator",
        text: "Após concluir o processo de formalização, a empresa finalmente estava pronta para começar.",
        duration: 3500,
      },
      {
        type: "player",
        text: "Pronto! Meu CNPJ está aberto. Agora é hora de colocar a empresa em funcionamento!",
        duration: 3500,
      },
    ],
    infoSpots: [
      {
        x: 1300,
        y: 320,
        text: "Parabéns por formalizar sua empresa! Esse é só o começo, agora é hora de cuidar bem dela. Boa sorte nessa nova jornada!",
      },
      {
        x: 820,
        y: 320,
        text: "Uma boa gestão financeira, organização e planejamento fazem toda a diferença para o sucesso do seu negócio.",
      },
      {
        x: 440,
        y: 340,
        text: "Lembre-se: buscar orientação de profissionais especializados pode ajudar sua empresa a crescer com mais segurança.",
      },
    ],
  },
  {
    id: "fasetransicao2",
    name: "Novos Desafios",
    phaseNumber: 2,
    phaseLabel: "Algum tempo depois",
    skyColor: 0x18233d,
    objectiveHint: "⬅ Continue à esquerda até chegar na JS Grilo.",
    groundColor: 0x2c3350,
    decorColor: 0x22304f,
    levelWidth: 1990,
    bg: "street2_bg.png",
    startX: 1880,
    startDirection: "left",
    hasBoss: false,
    exitInitiallyOpen: true,
    doorX: 230,
    groundY: 460,
    showExitArrow: true,
    exitDirection: "backward",
    characterScale: 1.8,

    narrative: [
      {
        type: "narrator",
        text: "Algum tempo depois...",
        duration: 3500,
      },
      {
        type: "narrator",
        text: "A empresa começou a crescer. Novos clientes chegaram e as responsabilidades aumentaram.",
        duration: 3500,
      },
      {
        type: "player",
        text: "Minha empresa está crescendo, mas preciso de ajuda para organizar tudo.",
        duration: 3500,
      },
      {
        type: "player",
        text: "Ouvi falar muito bem da JS Grilo Contabilidade & Gestão. Vou procurar a equipe deles.",
        duration: 3500,
      },
    ],
    infoSpots: [
      {
        x: 1430,
        y: 325,
        text: "Com a empresa crescendo, a papelada e as obrigações também aumentam, é hora de ter um bom apoio contábil.",
      },
      {
        x: 1130,
        y: 305,
        text: "Uma contabilidade de confiança faz toda diferença: ajuda a entender os números e tomar decisões melhores.",
      },
      {
        x: 720,
        y: 280,
        text: "Sou cliente da JS Grilo Contabilidade & Gestão há um tempo, recomendo demais, são muito bons no que fazem!",
      },
    ],
  },
  {
    id: "fase3",
    name: "JS Grilo Contabilidade & Gestão",
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
    bg: "office_bg.png", // nome do arquivo em assets/backgrounds/
    // Posição do boss/porta nesta fase (em pixels, dentro da imagem de fundo de 2200x540).
    // Ajuste bossX/bossY livremente pra encaixar o boss na cadeira/mesa da sua arte.
    // bossY é a linha do "chão" onde os pés do boss encostam (mesma lógica do player).
    bossX: 1740,
    bossY: 315,
    doorX: 1750, // porta de saída (some até vencer o boss)
    groundY: 460, // altura em que os PÉS do personagem encostam nesta fase (chão da perspectiva)
    showExitArrow: false, // fase final: sem seta, o jogo encerra na hora
    characterScale: 2.7, // tamanho do personagem só nesta fase (perspectivas diferentes = tamanhos diferentes)
    infoSpots: [
      {
        x: 210,
        y: 230,
        text: "Olá, Seja bem vindo a JS Grilo Contabilidade. Parabéns por chegar até aqui! Agora você vai conhecer assuntos mais avançados da contabilidade. Boa sorte!",
      },
      {
        x: 720,
        y: 230,
        text: "A legislação muda com frequência. Manter-se atualizado é essencial para qualquer empresa.",
      },
      {
        x: 1355,
        y: 210,
        text: "A contabilidade não serve apenas para cumprir obrigações. Ela também ajuda a empresa a crescer com mais segurança.",
      },
    ],
    boss: {
      name: "Gerente da JS Grilo",
      portrait: { idle: "boss3_idle.png", talk: "boss3_talk.png" },
      portraitHeight: 100,
      greeting:
        "Seja bem-vindo à JS Grilo! Eu me chamo Jaqueline, a responsável pelo escritório. Vamos ver o que você sabe sobre os temas mais avançados da contabilidade?",
      introLines: [
        "Vamos à primeira:",
        "Ótimo! Vamos pra próxima:",
        "Última pergunta, força:",
      ],
      correctLines: [
        "Isso mesmo, muito bem!",
        "Perfeito!",
        "Excelente resposta!",
      ],
      wrongLines: [
        "Quase lá.",
        "Essa é mais avançada, deixa eu explicar:",
        "Vamos entender juntos:",
      ],
      resultMessages: {
        3: "Impressionante! Você domina até os temas mais avançados da contabilidade. Poucos empresários chegam nesse nível, parabéns!",
        2: "Muito bom! Você já entende bastante, só alguns detalhes pra aperfeiçoar. E pra isso, contar com uma contabilidade especializada como a JS Grilo faz toda diferença.",
        1: "Esses temas mais avançados realmente pegam muita gente, e é exatamente pra isso que existe a JS Grilo. Você não precisa saber tudo sozinho, é só contar com a gente!",
        0: "Não se preocupe, esses são assuntos bem complexos mesmo, até pra quem já tem empresa há um tempo. É justamente por isso que ter uma contabilidade de confiança como a JS Grilo ao seu lado faz toda a diferença.",
      },
      questions: [
        {
          q: "A Reforma Tributária une alguns impostos em:",
          options: [
            "Um único Imposto de Renda",
            "CBS e IBS",
            "O fim dos tributos federais",
            "Mudanças apenas para o MEI",
          ],
          correct: 1,
          explanation:
            "A Reforma Tributária substitui diversos impostos sobre o consumo por dois novos tributos: CBS e IBS, tornando o sistema mais simples.",
        },

        {
          q: "O Imposto Seletivo incide sobre:",
          options: [
            "Rendimentos do Imposto de Renda",
            "Produtos nocivos à saúde ou ao meio ambiente",
            "Empresas recém-criadas",
            "Produtos considerados sustentáveis",
          ],
          correct: 1,
          explanation:
            "O Imposto Seletivo é aplicado sobre produtos que causam impactos à saúde ou ao meio ambiente, como cigarros e bebidas alcoólicas.",
        },

        {
          q: "Lucro entre empresas do mesmo grupo é:",
          options: [
            "Reconhecido normalmente",
            "Eliminado até virar lucro real",
            "Registrado em dobro",
            "Transformado em dívida",
          ],
          correct: 1,
          explanation:
            "Enquanto a operação ocorrer apenas dentro do grupo, esse lucro é eliminado na consolidação das demonstrações financeiras.",
        },

        {
          q: "O período de transição da reforma é:",
          options: [
            "Troca gradual dos tributos antigos pelos novos",
            "Período sem cobrança de impostos",
            "Prazo para encerrar empresas",
            "Benefício exclusivo do MEI",
          ],
          correct: 0,
          explanation:
            "Durante a transição, os tributos atuais e os novos coexistem para permitir uma adaptação gradual.",
        },

        {
          q: "CBS e IBS 'não cumulativos' significa:",
          options: [
            "O imposto aparece apenas uma vez na nota",
            "Permitem descontar o imposto pago antes",
            "São cobrados uma única vez na empresa",
            "Não geram créditos tributários",
          ],
          correct: 1,
          explanation:
            "A empresa pode aproveitar créditos dos impostos pagos nas etapas anteriores, evitando o chamado 'imposto sobre imposto'.",
        },

        {
          q: "No encerramento do exercício a empresa:",
          options: [
            "Fecha e reabre suas atividades",
            "Apura resultados e prepara relatórios",
            "Recebe perdão automático de impostos",
            "Encerra todos os contratos de trabalho",
          ],
          correct: 1,
          explanation:
            "Nesse momento, a empresa organiza suas contas e elabora as demonstrações contábeis do período.",
        },

        {
          q: "Consolidar balanços de um grupo é:",
          options: [
            "Somar os balanços sem ajustes",
            "Unir as demonstrações eliminando operações internas",
            "Criar um relatório de marketing",
            "Declarar todos os impostos do grupo",
          ],
          correct: 1,
          explanation:
            "A consolidação reúne as empresas do grupo como se fossem uma só, eliminando transações entre elas.",
        },

        {
          q: "A ECD (SPED Contábil) é:",
          options: [
            "Uma plataforma de vendas",
            "A contabilidade digital enviada ao governo",
            "Uma linha de crédito empresarial",
            "Uma declaração exclusiva para pessoas físicas",
          ],
          correct: 1,
          explanation:
            "A ECD substitui os antigos livros contábeis em papel pelo envio digital das informações ao governo.",
        },

        {
          q: "Imposto 'por fora' na nota significa:",
          options: [
            "O preço diminui automaticamente",
            "O valor do imposto fica mais transparente",
            "Os impostos deixam de existir",
            "O produto não possui tributos",
          ],
          correct: 1,
          explanation:
            "O consumidor consegue visualizar com mais clareza quanto do valor pago corresponde aos tributos.",
        },

        {
          q: "O que é o ágio (goodwill)?",
          options: [
            "Perda de valor dos bens da empresa",
            "Valor pago acima do patrimônio esperado",
            "Provisão para possíveis dívidas",
            "Capital usado nas operações diárias",
          ],
          correct: 1,
          explanation:
            "O ágio representa o valor pago além do patrimônio da empresa, considerando benefícios futuros como marca, clientes e potencial de lucro.",
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
  if (GameData.hasEnded) return; // evita salvar o ranking duas vezes na mesma partida
  GameData.hasEnded = true;

  const elapsedSeconds = Math.floor((Date.now() - GameData.startTime) / 1000);
  const finalScore = computeFinalScore(elapsedSeconds);

  saveRankingEntry(GameData.playerName, finalScore, elapsedSeconds);

  document.getElementById("end-overlay").classList.remove("hidden");
  document.getElementById("end-title").textContent = won
    ? "🏆 Parabéns!"
    : "Game Over";
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
}

// ---------------------------------------------------------
// BATALHA DE BOSS — PAUSA o jogo (física + input) enquanto ativa
// ---------------------------------------------------------
function positionBossDialogue(scene, bossSprite) {
  const bounds = bossSprite.getBounds();
  const scrollX = scene.cameras.main.scrollX;
  let screenX = bounds.centerX - scrollX;
  const screenTopY = bounds.top;

  screenX = Math.min(Math.max(screenX, 170), 960 - 170);

  const dialogueEl = document.getElementById("boss-dialogue");
  dialogueEl.style.left = `${screenX}px`;

  let bottom = 540 - screenTopY + 26;
  const boxHeight = dialogueEl.offsetHeight;
  const maxBottom = 540 - 50 - boxHeight; // deixa folga maior no topo (o cronômetro ocupa esse canto)
  if (boxHeight > 0 && bottom > maxBottom) {
    bottom = Math.max(maxBottom, 10);
  }
  dialogueEl.style.bottom = `${bottom}px`;
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
      playSfx(SFX.type); // <-- aqui
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
      timeLeft -= 1;
      headerEl.textContent = `⏱ ${timeLeft}s`;
      // Dispara o áudio de contagem UMA única vez, exatamente quando faltam 5s.
      // O arquivo tem 5s de duração e toca sem loop, terminando junto com o tempo.
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
    if (msg) {
      typeText(msg, () => {
        setTimeout(() => {
          if (isStale()) return;
          overlay.classList.add("hidden");
          finishBossUI();
          onComplete();
        }, 1800);
      });
    } else {
      overlay.classList.add("hidden");
      finishBossUI();
      onComplete();
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
    charIndex += 1;
    element.textContent = text.slice(0, charIndex);
    playSfx(SFX.type); // <-- aqui

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
// NARRATIVA DAS FASES DE TRANSIÇÃO
//
// - Bloqueia o movimento durante as falas.
// - Digita o texto letra por letra.
// - Um clique completa a digitação.
// - Outro clique avança para a próxima fala.
// - Também avança automaticamente após o duration.
// ---------------------------------------------------------
// ---------------------------------------------------------
// NARRATIVA DAS FASES DE TRANSIÇÃO (Unificada com o novo Narrador)
// ---------------------------------------------------------
function startNarrative(scene, narrative, onComplete) {
  if (!Array.isArray(narrative) || narrative.length === 0) {
    scene.inputManager.setEnabled(true);
    if (onComplete) onComplete();
    return;
  }

  // Bloqueia o movimento e as ações do jogador durante a historinha
  scene.player.setVelocityX(0);
  scene.inputManager.setEnabled(false);

  let currentIndex = 0;

  // Função interna que puxa a fala atual e agenda a próxima
  function proximaFala() {
    // Verificação de fim: se passou da última fala, libera o jogo
    if (currentIndex >= narrative.length) {
      scene.inputManager.setEnabled(true);
      if (onComplete) onComplete();
      return;
    }

    const dialogue = narrative[currentIndex];
    currentIndex++;

    // 1. Descobre quem está falando
    const isPlayer = dialogue.type === "player";
    const nomeFalante = isPlayer ? GameData.playerName : "Narrador";

    // 2. Formata o texto final (adicionando o nome de quem fala no topo e processando variáveis)
    let textoBruto = String(dialogue.text ?? "").replaceAll("{playerName}", GameData.playerName);
    const textoFinal = `${nomeFalante}:\n"${textoBruto}"`;

    // 3. Define as imagens (se no futuro você colocar a imagem do jogador, é só trocar no if)
    let idleImg = "narrador_idle";
    let talkImg = "narrador_talk";
    
    /* Exemplo para o futuro, se quiser colocar a foto do bonequinho do jogador falando:
    if (isPlayer) {
      idleImg = "player_rosto_fechado";
      talkImg = "player_rosto_falando";
    }
    */

    // 4. Chama a ferramenta de popup animada!
    chamarNarrador(
      scene,
      idleImg,
      talkImg,
      null, // Sem áudio específico pré-carregado nas transições no momento
      textoFinal,
      () => {
        // A MÁGICA: O callback 'onComplete' da caixa de texto chama a próxima fala da lista
        proximaFala();
      }
    );
  }

  // Dá o pontapé inicial chamando a primeira fala do array
  proximaFala();
}

// ---------------------------------------------------------
// SISTEMA DO NARRADOR ANIMADO (Global)
// ---------------------------------------------------------
function chamarNarrador(cena, imgIdleKey, imgTalkKey, audioKey, texto, onComplete) {
  const overlay = cena.add.rectangle(480, 270, 960, 540, 0x000000, 0.8)
    .setOrigin(0.5).setDepth(100).setScrollFactor(0).setInteractive();

  const box = cena.add.graphics().setDepth(101).setScrollFactor(0);
  box.fillStyle(0x002B54, 1);
  box.lineStyle(4, 0xFF8F00, 1);
  box.fillRoundedRect(180, 100, 600, 340, 16);
  box.strokeRoundedRect(180, 100, 600, 340, 16);

  const avatarIdle = cena.add.image(480, 170, imgIdleKey).setDepth(102).setScrollFactor(0);
  const avatarTalk = cena.add.image(480, 170, imgTalkKey).setDepth(102).setScrollFactor(0).setVisible(false);

  const messageText = cena.add.text(480, 250, "", {
    fontSize: '20px',
    fontFamily: 'Arial',
    color: '#F4F7F9',
    align: 'center',
    wordWrap: { width: 540 }
  }).setOrigin(0.5, 0).setDepth(102).setScrollFactor(0);

  const hintText = cena.add.text(480, 410, "Clique para continuar ➡", {
    fontSize: '16px', fontStyle: 'italic', color: '#FFB347'
  }).setOrigin(0.5).setDepth(102).setScrollFactor(0).setAlpha(0);

  let voice;
  if (audioKey && cena.cache.audio.exists(audioKey)) {
    voice = cena.sound.add(audioKey);
    voice.play();
  }

  let isTalking = true;
  const talkInterval = setInterval(() => {
    if (isTalking) {
      avatarIdle.setVisible(!avatarIdle.visible);
      avatarTalk.setVisible(!avatarIdle.visible);
    }
  }, 150);

  let charIndex = 0;
  let isTyping = true;
  const typeInterval = setInterval(() => {
    charIndex++;
    messageText.setText(texto.slice(0, charIndex));
    playSfx(SFX.type);
    
    if (charIndex >= texto.length) {
      clearInterval(typeInterval);
      clearInterval(talkInterval);
      avatarIdle.setVisible(true);
      avatarTalk.setVisible(false);
      isTyping = false;
      isTalking = false;
      hintText.setAlpha(1);
    }
  }, 40);

  overlay.on('pointerdown', () => {
    if (isTyping) {
      clearInterval(typeInterval);
      clearInterval(talkInterval);
      avatarIdle.setVisible(true);
      avatarTalk.setVisible(false);
      messageText.setText(texto);
      isTyping = false;
      isTalking = false;
      hintText.setAlpha(1);
    } else {
      if (voice && voice.isPlaying) voice.stop(); 
      overlay.destroy();
      box.destroy();
      avatarIdle.destroy();
      avatarTalk.destroy();
      messageText.destroy();
      hintText.destroy();

      if (onComplete) onComplete();
    }
  });
}

// ---------------------------------------------------------
// CENA DO MAPA DAS ILHAS
// ---------------------------------------------------------
class MapScene extends Phaser.Scene {
  constructor() {
    super("MapScene");
  }

  preload() {
    if (!this.textures.exists("map_bg")) {
      this.load.image("map_bg", "assets/backgrounds/map_bg.png");
    }
    if (!this.textures.exists("icon_locked")) {
      this.load.image("icon_locked", "assets/icons/cadeado.png");
      this.load.image("icon_check", "assets/icons/check.png");
    }
    // --- CARREGANDO OS ASSETS DO NARRADOR ---
    if (!this.textures.exists("narrador_idle")) {
      this.load.image("narrador_idle", "assets/characters/narrador_fechado.png");
      this.load.image("narrador_talk", "assets/characters/narrador_falando.png");
    }
    if (!this.cache.audio.exists("voz_mapa")) {
      this.load.audio("voz_mapa", "assets/audio/voz_mapa.mp3"); 
    }
  }

  create() {
    const hud = document.getElementById("hud");
    if (hud) hud.style.display = "none";
    const btnLeft = document.getElementById("btn-left");
    if (btnLeft) btnLeft.style.display = "none";
    const btnRight = document.getElementById("btn-right");
    if (btnRight) btnRight.style.display = "none";

    const bg = this.add.image(480, 270, "map_bg").setDepth(0);
    bg.setDisplaySize(960, 540);

    const islands = [
      { id: 0, name: "FINECAP", x: 175, y: 450, arrowX: 190, arrowY: 210, iconX: 170, iconY: 365 },
      { id: 1, name: "TRILHA DIGITAL", x: 510, y: 200, arrowX: 510, arrowY: 60, iconX: 510, iconY: 135 },
      { id: 2, name: "ACELERADOR DIGITAL", x: 830, y: 450, arrowX: 840, arrowY: 240, iconX: 820, iconY: 400 }
    ];

    const pathGraphics = this.add.graphics().setDepth(1);
    pathGraphics.lineStyle(4, 0xffe27a, 0.8);

    for (let i = 0; i < islands.length - 1; i++) {
      this.drawDottedLine(pathGraphics, islands[i].x, islands[i].y, islands[i + 1].x, islands[i + 1].y);
    }

    islands.forEach((island) => {
      let status = "locked";
      if (island.id < GameData.phaseIndex) {
        status = "completed";
      } else if (island.id === GameData.phaseIndex) {
        status = "current";
      }

      const zone = this.add.zone(island.x, island.y, 160, 140)
        .setInteractive({ useHandCursor: true })
        .setDepth(20);

      this.criarPlacaArredondada(island.x, island.y + 60, island.name, 0x002b54, "#F4F7F9");

      if (status === "completed") {
        this.add.image(island.iconX, island.iconY, "icon_check").setOrigin(0.5).setDepth(5).setScale(0.5);
      } else if (status === "locked") {
        this.add.image(island.iconX, island.iconY, "icon_locked").setOrigin(0.5).setDepth(5).setScale(0.1);
      } else if (status === "current") {
        const arrow = this.add.text(island.arrowX, island.arrowY, "⬇", {
          fontSize: "60px", color: "#FF8F00", fontStyle: "bold"
        }).setOrigin(0.5).setDepth(10);

        this.tweens.add({
          targets: arrow, y: island.arrowY + 15, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut"
        });
      }

      zone.on('pointerdown', () => {
        if (status === "current") {
          playSfx(SFX.type);
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("PhaseScene", { phaseIndex: island.id });
          });
        } else if (status === "completed") {
          this.showFeedbackMessage(island.x, island.y - 40, "✅ Fase já concluída!", '#2E7D32');
        } else {
          this.showFeedbackMessage(island.x, island.y - 40, "🔒 Ilha Bloqueada! Complete a anterior.", '#D32F2F');
        }
      });
    });

    // --- LÓGICA DO NARRADOR POR FASE ---
    let textoNarrador = "";
    let audioNarrador = null; // Se você gravar áudios para as fases 2 e 3, pode carregar no preload e trocar aqui

    if (GameData.phaseIndex === 0) {
      textoNarrador = `Olá, ${GameData.playerName}! Seja bem-vindo à sua jornada. Clique na primeira ilha desbloqueada para iniciar seu treinamento!`;
      audioNarrador = "voz_mapa";
    } else if (GameData.phaseIndex === 1) {
      textoNarrador = "Muito bem! Você concluiu a primeira etapa. A Trilha Digital já está disponível para o próximo desafio.";
      audioNarrador = null; 
    } else if (GameData.phaseIndex === 2) {
      textoNarrador = "Excelente progresso! A última etapa, Finanças na Mão, está liberada. Vamos lá!";
      audioNarrador = null;
    }

    // Só chama a caixa de diálogo se houver texto para aquela fase
    if (textoNarrador !== "") {
      chamarNarrador(this, "narrador_idle", "narrador_talk", audioNarrador, textoNarrador, () => {
        console.log("Narrador terminou de falar!");
      });
    }
  }

  // --- FUNÇÕES AUXILIARES ---
  criarPlacaArredondada(x, y, texto, corFundo, corTexto) {
    const label = this.add.text(x, y, texto, { fontSize: "18px", fontStyle: "bold", color: corTexto }).setOrigin(0.5).setDepth(6);
    const bg = this.add.graphics().setDepth(5);
    bg.fillStyle(corFundo, 1);
    bg.fillRoundedRect(x - label.width / 2 - 12, y - label.height / 2 - 6, label.width + 24, label.height + 12, 8);
  }

  drawDottedLine(graphics, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dashLength = 10;
    const gapLength = 8;
    let currentDist = 0;

    while (currentDist < dist) {
      const startX = x1 + (dx * currentDist) / dist;
      const startY = y1 + (dy * currentDist) / dist;
      const endDist = Math.min(currentDist + dashLength, dist);
      const endX = x1 + (dx * endDist) / dist;
      const endY = y1 + (dy * endDist) / dist;

      graphics.lineBetween(startX, startY, endX, endY);
      currentDist += dashLength + gapLength;
    }
  }

  showFeedbackMessage(x, y, text, color) {
    if (this.isShowingMessage) return;
    this.isShowingMessage = true;
    playSfx(SFX.tick);
    const safeX = Phaser.Math.Clamp(x, 220, 740);

    const msg = this.add.text(safeX, y, text, {
      fontSize: '14px', fontStyle: 'bold', color: '#ffffff', backgroundColor: color, padding: { x: 10, y: 6 }
    }).setOrigin(0.5).setAlpha(0).setDepth(20);

    this.tweens.add({
      targets: msg, y: y - 20, alpha: 1, duration: 300, ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          this.tweens.add({
            targets: msg, alpha: 0, duration: 300,
            onComplete: () => { msg.destroy(); this.isShowingMessage = false; }
          });
        });
      }
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
      if (!this.textures.exists(idleKey)) {
        this.load.image(idleKey, `assets/bosses/${cfg.boss.portrait.idle}`);
        this.load.image(talkKey, `assets/bosses/${cfg.boss.portrait.talk}`);
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
        const portraitHeight = cfg.boss.portraitHeight ?? 260;
        const flip = cfg.boss.portraitFlip === true;

        const idleTex = this.textures.get(idleKey).getSourceImage();
        const talkTex = this.textures.get(talkKey).getSourceImage();
        const idleBaseScale = portraitHeight / idleTex.height;
        const talkBaseScale = portraitHeight / talkTex.height;

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

        this.bossSprite = this.bossIdleSprite; // usado pra posicionar o balão de diálogo

        // Respiração sutil — escala em cima da própria base (pés ficam travados no lugar)
        this.tweens.add({
          targets: this.bossIdleSprite,
          scaleY: idleBaseScale * 1.02,
          scaleX: idleBaseScale * 0.995,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        this.tweens.add({
          targets: this.bossTalkSprite,
          scaleY: talkBaseScale * 1.02,
          scaleX: talkBaseScale * 0.995,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });

        this.bossTalkInterval = null;
        this.startBossTalkAnim = () => {
          if (this.bossTalkInterval) return;
          this.bossTalkInterval = setInterval(() => {
            const showTalk = !this.bossTalkSprite.visible;
            this.bossTalkSprite.setVisible(showTalk);
            this.bossIdleSprite.setVisible(!showTalk);
          }, 160);
        };
        this.stopBossTalkAnim = () => {
          clearInterval(this.bossTalkInterval);
          this.bossTalkInterval = null;
          this.bossIdleSprite.setVisible(true);
          this.bossTalkSprite.setVisible(false);
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

    // Apresentação do capítulo
    showPhaseIntro(cfg, () => {
      if (cfg.narrative?.length) {
        startNarrative(this, cfg.narrative);
      } else {
        this.inputManager.setEnabled(true);
      }
    });
  }

  onBossDefeated() {
    if (this.config.showExitArrow === false) {
      this.goToNextPhase();
      return;
    }
    this.doorOpen = true;
    this.door.setVisible(true);
    this.doorGlow.setVisible(true);
  }

  goToNextPhase() {
    const next = this.phaseIndex + 1;
    if (next >= PHASES.length) {
      endGame(true); // Terminou tudo, vai pra tela do QR Code / Ranking
    } else {
      GameData.phaseIndex = next; // Libera a próxima ilha globalmente
      updateHUD();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        // Volta para o Mapa em vez de carregar a próxima fase direto
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
  document.getElementById("start-overlay").classList.add("hidden");
  game.scene.start("MapScene");
});

// Esconde o aviso assim que a pessoa começar a digitar de novo
nameInput.addEventListener("input", () => {
  nameWarning.classList.add("hidden");
});

// ---------------------------------------------------------
// TELA FINAL — ranking e reinício
// ---------------------------------------------------------
document.getElementById("view-ranking-btn").addEventListener("click", () => {
  renderRankingInto("ranking-list-content");
  document.getElementById("ranking-overlay").classList.remove("hidden");
});
document.getElementById("close-ranking-btn").addEventListener("click", () => {
  document.getElementById("ranking-overlay").classList.add("hidden");
});
document.getElementById("restart-btn").addEventListener("click", () => {
  document.getElementById("end-overlay").classList.add("hidden");
  nameInput.value = "";
  nameWarning.classList.add("hidden");
  showPanel("panel-menu");
  document.getElementById("start-overlay").classList.remove("hidden");
});
