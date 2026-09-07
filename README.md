# 🎮 Jornada Sebrae

**Jornada Sebrae** é um jogo educativo interativo desenvolvido em pixel art para ensinar e engajar empreendedores em temas essenciais de **marketing digital, tráfego pago, presença online e gestão de negócios**.

O jogador assume o papel de um empresário em crescimento que navega por um arquipélago de desafios, conversa com mentores, consulta murais informativos e enfrenta chefes analistas em batalhas dinâmicas de perguntas e respostas.

---

## 🚀 Funcionalidades

- 🎮 **Arquitetura Híbrida:** Desenvolvido em JavaScript combinando **Phaser 3** (lógica e renderização do jogo) com **DOM HTML5/CSS3** (interface gráfica leve e responsiva para textos e diálogos).
- 👤 **Seleção de Personagens:** Escolha entre múltiplos avatares com spritesheets de animação exclusivos de corrida e repouso.
- 🗺️ **Mapa Interativo de Ilhas:** Sistema de progressão visual com movimentação por barco, animações elásticas de pop-up para fases concluídas e feedback sonoro de vitória.
- 📖 **Narrador Animado:** Sistema de sincronização labial e ciclos orgânicos de piscada de olhos (*frame-by-frame*).
- 🏢 **3 Fases Temáticas:**
  - **Fase 1 (Boas-Vindas):** Introdução à FINECAP e atuação do Sebrae no Rio Grande do Norte.
  - **Fase 2 (Presença Digital):** Perfil da Empresa no Google, estratégias de atendimento no WhatsApp e uso prático de IA.
  - **Fase 3 (Acelerador Digital):** Tráfego pago estruturado, funil de vendas, métricas de performance (ROI/ROAS) e análise pós-clique.
- 📱 **QR Code Interativo:** Ao vencer o último boss, um modal com contagem regressiva de 25 segundos e botão de avanço apresenta o QR Code direto para a solução **Acelerador Digital do Sebrae**.
- 🔀 **Batalhas Dinâmicas de Quiz:** Perguntas e alternativas sorteadas e embaralhadas aleatoriamente via algoritmo Fisher-Yates.
- ⏱️ **Cronômetro com Alerta Sonoro:** Contagem de tempo para respostas que impacta na pontuação de velocidade, acompanhado de efeito sonoro de contagem regressiva nos segundos finais.
- 💬 **Explicações Contextualizadas:** Feedback didático imediato do analista após cada escolha (correta ou incorreta).
- 🏆 **Ranking Top 10:** Placar de recordes dos jogadores persistido localmente via `localStorage`.
- ⏸️ **Controles Globais:** Modal de pause integrado que congela física, animações e rotinas de digitação, além de barra de ajuste do volume de áudio em tempo real.
- 📱 **Multiplataforma:** Totalmente responsivo para navegadores desktop (teclado) e dispositivos móveis (botões de toque na tela).

---

## 📚 Conteúdo Abordado

- **Institucional & Regional:** História e relevância cultural da FINECAP em Pau dos Ferros e as soluções de apoio do Sebrae RN aos pequenos negócios.
- **Presença Digital Local:** Configuração estratégica do Perfil da Empresa no Google (Google Meu Negócio) e o impacto das avaliações na confiança de novos clientes.
- **Atendimento e Vendas no WhatsApp:** Boas práticas de atendimento consultivo, condução de conversa e geração de valor versus apenas informar preço.
- **Inteligência Artificial Aplicada:** Uso da IA generativa para ideação de conteúdo, legendas e rotinas de planejamento, com foco na revisão humana.
- **Tráfego Pago & Mídia de Performance:** Diferenças entre impulsionar publicação e criar campanhas estruturadas com segmentação de persona e público-alvo.
- **Métricas e Funil de Vendas:** Diagnóstico de gargalos no pós-clique, cálculo de retorno sobre investimento (ROI/ROAS) e ciclo sustentável de atração e retenção de clientes.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3** (layout responsivo com transform-scale proporcional 16:9)
- **JavaScript (ES6+)**
- **Phaser 3.70.0** (Engine de física Arcade e renderização 2D)
- **Pixel Art Assets** (Sprites e ambientações temáticas)

---

## 🎯 Objetivo

Demonstrar a eficácia da **gamificação** como ferramenta pedagógica para eventos e feiras de negócios, tornando o aprendizado sobre marketing de performance e transformação digital acessível, leve e competitivo para empreendedores locais.

---

## 👨‍💻 Desenvolvedor

Desenvolvido por **Matheus Sena**.

🔗 [Acesse o jogo online aqui](https://matheussena45.github.io/Jornada-Sebrae---Game/index.html)