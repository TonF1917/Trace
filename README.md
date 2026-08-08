# Trace

**[English](#english) | [中文](#%E4%B8%AD%E6%96%87)**

---

<p align="center">
  <img src="./assets/demo1.png" width="600" alt="Trace Dashboard Demo">
</p>
<p align="center">
  <img src="./assets/demo2.png" width="600" alt="Trace Topology Demo">
</p>



<h2 id="english">🇬🇧 English</h2>

**Compare how different media frame the same event.**

Trace is an open-source, local-first analytical web application designed for academic researchers, media analysts, and political scientists. It allows users to structurally compare how different institutional media construct distinct geopolitical or ideological realities from the exact same raw event.

### 🌟 Key Features

- **Automated Framing Extraction**: Utilizes LLMs with robust JSON repair parsers to extract narrative frames, main actors, and blame targets from news articles.
- **Blame Topology Visualization**: Automatically generates an interactive network graph (Topology) showing attribution direction and framing relationships.
- **Graph Analytics & Louvain Communities**: Integrated Louvain community detection for automatic sub-faction clustering and multi-dimensional node centrality metrics (Degree, In-Degree, Out-Degree, Betweenness).
- **AI Topology Briefing Report Generator**: One-click generation of publication-grade Markdown briefing reports analyzing network power dynamics and narrative divides.
- **Local-First & Privacy-Focused**: No backend or external databases. All your research data is stored securely in your browser's local storage.
- **i18n Support**: Native English and Chinese UI switching.

### 🛠️ Features Overview

**1. Dashboard (Project Management)**
- **Dual-Mode AI Configuration**: Seamlessly switch between pre-configured default APIs (FreeLLMAPI) and custom LLM providers (e.g., OpenAI, Claude, Gemini, DeepSeek, LM Studio, Ollama) with custom System Prompt support.
- **Project Isolation**: Manage multiple research topics as distinct projects with isolated data and topologies.

**2. Data & Article Manager (Core Tools)**
- **Add Text**: Manually paste raw text or drag-and-drop files (PDF, DOCX, TXT, EPUB) to add new source materials to your project.
- **Research**: Use the AI to automatically gather background contexts, simulate different perspectives, or generate synthetic articles related to your topic.
- **Deep Extract All**: The primary extraction engine with auto-repair JSON parsing. It reads through all unprocessed articles line-by-line to extract `Actors`, `Narrative Frames`, `Tones`, and complex `Blame/Support Relationships`.
- **Connect Existing**: Forces the AI to re-read the articles specifically looking for hidden relationships between the *already discovered* entities in your network.
- **AI Merge**: A powerful deduplication tool. It commands the LLM to identify and merge synonymous entities extracted from different articles to clean up the network structure.
- **TARGET NODES/PASS**: A slider/input that controls the density of the extraction.

**3. Topology Visualization**
- **Interactive Narrative Network**: View the complex web of who is blaming whom, colored by narrative frames, tones, or Louvain community clusters.
- **Manual Mode**: Drag nodes to pin them in place. Click a pinned node to unpin it and let physics take over.
- **Explore Mode**: Click any node to isolate its "Ego-Network", highlighting only its direct connections.
- **View Controls**: Toggle the visibility of Source articles, switch between straight/curved edges, group nodes by modularity classes, or scale nodes by frequency.
- **Enclosures / Group Hulls**: Automatic convex hull rendering around Louvain communities or organizational hierarchies.
- **Export**: Export the entire dataset as JSON/CSV or capture high-resolution PNG/JPEG images of your topology for academic papers.

### 🚀 Quick Start

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/Trace.git
   cd Trace
   ```
2. Install dependencies:
   ```bash
   cd app
   npm install
   ```
3. Start the local server:
   ```bash
   npm run dev
   ```
4. Click `Trace.exe` (or `Trace.command` in Mac/Linux) in the root folder to launch the application. Or open `http://localhost:5173`.

### 📖 Tutorial

1. **Configure API**: Click the settings icon to set up your LLM provider (e.g., OpenAI, LM Studio, Ollama). All data is processed locally in your browser. If there is no API available, you can purchase it from the official websites of major platforms or use a free API: https://github.com/tashfeenahmed/freellmapi
2. **Create Project**: Click "New Project" and define the event or topic you want to analyze.
3. **Ingest Data**: In the Data & Article Manager, use **Add Text** or **Research** to gather source materials.
4. **Run Analysis**: Set your **TARGET NODES/PASS** and click **Deep Extract All** to extract the initial network. Use **Connect Existing** to discover hidden links, and run **AI Merge** to clean up duplicate entities.
5. **Explore Topology**: Switch to the **Topology** tab. Use **Manual Mode** to drag and pin nodes, or **Explore Mode** to click and highlight specific sub-networks.
6. **Filter & Export**: Use the left sidebar to filter by source, frame, or relation type. Export your data (JSON/CSV) or save the topology as a high-resolution image (PNG/JPEG).

**4. Graph Analytics & AI Briefing Report**
- **Centrality Rankings Table**: Sort and filter entities by Degree (total connections), In-Degree (blame targets), Out-Degree (accusers), and Betweenness Centrality (bridge actors).
- **AI Topology Report**: Send graph topological metrics to the LLM to generate structured Markdown analytical reports with one-click `.md` export.

---

<h2 id="中文">🇨🇳 中文</h2>

**比较不同来源如何构建同一事件的叙事**

Trace 是一个基于本地的 AI 分析工具，专为研究人员、媒体分析师设计。它可以帮助用户对相同事件在不同媒体机构下的框架构建和叙事差异进行结构化的图谱比较。

### 🌟 核心功能

- **自动化叙事提取**：利用带强力 JSON 容错修复的大语言模型（LLM）从新闻文本中提取叙事框架、主要行动者及指责对象。
- **指责拓扑图可视化**：自动生成交互式的网络拓扑图，展示归因方向、框架关系与 Louvain 社群圈选。
- **高级图分析算法**：集成 Louvain 社群聚类算法与节点中心性度量（度数 Degree、入度焦点 In-Degree、出度发起 Out-Degree、介数中心性 Betweenness）。
- **AI 拓扑解读报告生成器**：结合网络全貌指标一键生成学术级 Markdown 分析报告，并支持导出 `.md` 文件。
- **本地优先与隐私保护**：无后端、无外部数据库。您的所有分析数据均安全地保存在浏览器的本地存储中。
- **多语言支持**：原生支持中文与英文界面一键切换。

### 🛠️ 功能详解

**1. 仪表盘 (项目管理)**
- **本地/云端双擎配置**：预置开箱即用的 FreeLLMAPI，支持自定义配置 OpenAI, Claude, Gemini, DeepSeek, LM Studio, Ollama 等任意 API 及自定义 System Prompt 模板。
- **项目隔离管理**：将不同的研究主题作为独立的项目进行管理，数据与拓扑图互不干扰。

**2. 数据与文献管理器 (核心操作盘)**
- **添加文本 (Add Text)**：支持手动粘贴纯文本，或直接拖拽 PDF、DOCX、TXT、EPUB 等文件到界面中。
- **自动研究 (Research)**：让 AI 根据您的主题，自动在后台生成不同立场的模拟文章或检索相关背景上下文。
- **深度提取全部 (Deep Extract All)**：核心提炼引擎，带 JSON 自动容错修复，提炼出 `行动者`、`叙事框架`、`情感基调` 以及复杂的 `指责/支持关系`。
- **连接现有节点 (Connect Existing)**：寻找已存在实体之间的隐藏关系，极大丰富网络的连通性。
- **AI 实体合并 (AI Merge)**：大模型智能合并同义实体（例如将“美国政府”和“合众国”合并为一个节点）。
- **单次提取密度 (TARGET NODES/PASS)**：控制 AI 提取粒度的参数。

**3. 拓扑图可视化 (Topology View)**
- **交互式叙事网络**：通过物理引力引擎，可视化“谁在指责谁”关系网，并支持按 Louvain 社群聚类圈选画出凹凸包。
- **手动排版与探索模式**：支持节点固定、解固与单节点 Ego-Net 局部高亮。

**4. 图谱深度分析与 AI 报告 (Graph Analytics View)**
- **中心性度量榜单**：精准度量并按 Total Degree、In-Degree (归因焦点)、Out-Degree (发起方) 和 Betweenness Centrality (跨阵营枢纽) 排序筛选节点。
- **AI 拓扑解读报告**：一键生成分析报告并导出 Markdown。

### 🚀 快速开始

1. 克隆本仓库：
   ```bash
   git clone https://github.com/yourusername/Trace.git
   cd Trace
   ```
2. 安装依赖：
   ```bash
   cd app
   npm install
   ```
3. 运行本地服务：
   ```bash
   npm run dev
   ```
4. 直接点击根目录下的 `Trace.exe` (Mac/Linux 下为 `Trace.command`) 即可启动。或者直接在浏览器打开 `http://localhost:5173`。

### 📖 使用教程

1. **配置 API**：点击右上角设置图标配置您的大语言模型（支持 OpenAI, LM Studio, Ollama 等）。数据全程在本地浏览器处理。若没有api可以从各大平台官网购买获取或者使用免费API: https://github.com/tashfeenahmed/freellmapi
3. **创建项目**：点击“New Project”创建一个新项目，设定您要分析的主题。
4. **导入数据**：进入项目后，使用控制台的 **添加文本 (Add Text)** 导入自有文献，或点击 **自动研究 (Research)** 让 AI 帮您收集上下文。
5. **运行分析**：设定好 **单次提取密度 (TARGET NODES/PASS)**，点击 **深度提取全部 (Deep Extract All)** 开始提炼叙事网络。您还可以使用 **连接现有节点 (Connect Existing)** 挖掘潜在关联，最后通过 **AI 实体合并 (AI Merge)** 清洗冗余节点。
6. **探索拓扑图**：切换到 **拓扑图 (Topology)** 标签页。使用 **手动排版 (Manual)** 拖拽梳理网络，或在 **探索 (Explore)** 模式下点击节点查看局部关系。
7. **筛选与导出**：通过侧边栏过滤不需要的连线，排版完成后，即可将分析结果导出为结构化数据或高清大图。


## 🛡️ License

**Trace** is distributed under a **Dual License** model:

1. **GNU AGPLv3 License** (Open Source)
   - Free for personal, academic, and non-commercial use.
   - You are free to modify and distribute the code, provided that any derivative works are also open-sourced under the AGPLv3 license. (See the [LICENSE](./LICENSE) file for details).

2. **Commercial License**
   - If you wish to use Trace in a commercial product, integrate it into a closed-source service, or avoid the restrictive terms of the AGPLv3 license, you must obtain a commercial license.
   - Please contact **tonf.academic@gmail.com** to discuss commercial licensing options.

## 📞 Contact

If you have any questions or feedback, please contact: **tonf.academic@gmail.com**
