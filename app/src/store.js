import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

const EXAMPLE_PROJECT = {
  id: 'example-nep-1921',
  createdAt: new Date().toISOString(),
  name: 'New Economic Policy (1921-1928)',
  description: 'An examination of the NEP as a strategic retreat from war communism, focusing on its economic reforms, intra-party factionalism, and social impact.',
  frames: [
    'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY',
    'INTRA-PARTY FACTIONALISM',
    'SOCIAL STRATIFICATION AND CLASS FORMATION',
    'STATE CAPITALISM',
    'URBAN VS. RURAL DIVIDE'
  ],
  tones: ['Critical', 'Objective', 'Alarmed', 'Sympathetic'],
  relations: [
    'Opposes / Blames',
    'Supports / Allies',
    'Influences / Controls',
    'Negotiates / Compromises',
    'Funds / Finances',
    'Represents',
    'Incites / Mobilizes',
    'Belongs To'
  ],
  isExample: true
};

const RAW_RELATIONS = [
  // Pravda Archives (1921)
  { source_name: 'Pravda Archives (1921)', source_id: 'pravda-archives-1921', date: '1921-03-15', main: 'Vladimir Lenin', target: 'War Communism', rel: 'Opposes / Blames', frame: 'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', tone: 'Critical', quote: 'War communism was imposed by war and ruin. It was not, nor could it be, a policy that corresponded to economic tasks.' },
  { source_name: 'Pravda Archives (1921)', source_id: 'pravda-archives-1921', date: '1921-03-15', main: 'Vladimir Lenin', target: 'New Economic Policy', rel: 'Supports / Allies', frame: 'STATE CAPITALISM', tone: 'Objective', quote: 'We must allow a degree of free trade and private enterprise to restore agricultural output.' },
  { source_name: 'Pravda Archives (1921)', source_id: 'pravda-archives-1921', date: '1921-03-15', main: 'Vladimir Lenin', target: 'Gosplan', rel: 'Influences / Controls', frame: 'STATE CAPITALISM', tone: 'Objective', quote: 'Gosplan must regulate market transactions while retaining command over heavy industry.' },
  { source_name: 'Pravda Archives (1921)', source_id: 'pravda-archives-1921', date: '1921-03-15', main: 'Vladimir Lenin', target: 'Peasantry', rel: 'Negotiates / Compromises', frame: 'URBAN VS. RURAL DIVIDE', tone: 'Sympathetic', quote: 'The tax in kind is a compromise with the millions of small peasant proprietors.' },
  { source_name: 'Pravda Archives (1921)', source_id: 'pravda-archives-1921', date: '1921-03-15', main: 'Workers Opposition', target: 'Vladimir Lenin', rel: 'Opposes / Blames', frame: 'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', tone: 'Alarmed', quote: 'Reintroducing market mechanisms betrays the socialist goal of the revolution.' },
  { source_name: 'Pravda Archives (1921)', source_id: 'pravda-archives-1921', date: '1921-03-15', main: 'Workers Opposition', target: 'Party Bureaucracy', rel: 'Belongs To', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Critical', quote: 'Trade unions must manage industry directly rather than bureaucratic appointees.' },
  { source_name: 'Pravda Archives (1921)', source_id: 'pravda-archives-1921', date: '1921-03-15', main: 'Industrial Proletariat', target: 'Worker Masses', rel: 'Belongs To', frame: 'SOCIAL STRATIFICATION AND CLASS FORMATION', tone: 'Objective', quote: 'Urban industrial workers form the ideological core of the proletarian state.' },
  { source_name: 'Pravda Archives (1921)', source_id: 'pravda-archives-1921', date: '1921-03-15', main: 'War Communism', target: 'Industrial Proletariat', rel: 'Opposes / Blames', frame: 'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', tone: 'Critical', quote: 'Forced requisitioning depleted urban food supplies and reduced factory labor force.' },

  // Izvestia (1922)
  { source_name: 'Izvestia (1922)', source_id: 'izvestia-1922', date: '1922-06-20', main: 'NEPmen', target: 'Peasantry', rel: 'Influences / Controls', frame: 'URBAN VS. RURAL DIVIDE', tone: 'Objective', quote: 'Private traders and NEPmen dominate grain procurement in rural markets.' },
  { source_name: 'Izvestia (1922)', source_id: 'izvestia-1922', date: '1922-06-20', main: 'NEPmen', target: 'State Capitalism', rel: 'Belongs To', frame: 'STATE CAPITALISM', tone: 'Objective', quote: 'Private retail capital flourishes under the umbrella of regulated state capitalism.' },
  { source_name: 'Izvestia (1922)', source_id: 'izvestia-1922', date: '1922-06-20', main: 'NEPmen', target: 'Party Bureaucracy', rel: 'Funds / Finances', frame: 'SOCIAL STRATIFICATION AND CLASS FORMATION', tone: 'Critical', quote: 'Private traders pay tax duties and license fees directly to state revenue agencies.' },
  { source_name: 'Izvestia (1922)', source_id: 'izvestia-1922', date: '1922-06-20', main: 'Peasantry', target: 'War Communism', rel: 'Opposes / Blames', frame: 'URBAN VS. RURAL DIVIDE', tone: 'Critical', quote: 'Peasants welcome the end of forced requisitioning (prodrazverstka).' },
  { source_name: 'Izvestia (1922)', source_id: 'izvestia-1922', date: '1922-06-20', main: 'Peasantry', target: 'New Economic Policy', rel: 'Supports / Allies', frame: 'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', tone: 'Sympathetic', quote: 'Farmers respond enthusiastically to the fixed tax-in-kind system.' },
  { source_name: 'Izvestia (1922)', source_id: 'izvestia-1922', date: '1922-06-20', main: 'Cheka / OGPU', target: 'NEPmen', rel: 'Influences / Controls', frame: 'STATE CAPITALISM', tone: 'Alarmed', quote: 'State security organs monitor private merchants for illegal speculation.' },
  { source_name: 'Izvestia (1922)', source_id: 'izvestia-1922', date: '1922-06-20', main: 'Kulaks', target: 'Peasantry', rel: 'Belongs To', frame: 'SOCIAL STRATIFICATION AND CLASS FORMATION', tone: 'Objective', quote: 'Wealthier peasants expand grain holdings within village communes.' },

  // Bolshevik Journal (1923)
  { source_name: 'Bolshevik Journal (1923)', source_id: 'bolshevik-journal-1923', date: '1923-10-15', main: 'Scissors Crisis', target: 'Peasantry', rel: 'Opposes / Blames', frame: 'URBAN VS. RURAL DIVIDE', tone: 'Alarmed', quote: 'High industrial goods prices discourage peasants from selling surplus grain to cities.' },
  { source_name: 'Bolshevik Journal (1923)', source_id: 'bolshevik-journal-1923', date: '1923-10-15', main: 'Scissors Crisis', target: 'Industrial Proletariat', rel: 'Opposes / Blames', frame: 'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', tone: 'Critical', quote: 'High manufactured goods prices threaten factory employment and real worker wages.' },
  { source_name: 'Bolshevik Journal (1923)', source_id: 'bolshevik-journal-1923', date: '1923-10-15', main: 'Leon Trotsky', target: 'Scissors Crisis', rel: 'Opposes / Blames', frame: 'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', tone: 'Alarmed', quote: 'Trotsky demonstrates the widening price scissors at the 12th Party Congress.' },
  { source_name: 'Bolshevik Journal (1923)', source_id: 'bolshevik-journal-1923', date: '1923-10-15', main: 'Leon Trotsky', target: 'Left Opposition', rel: 'Belongs To', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Objective', quote: 'Trotsky leads the Left Opposition platform advocating rapid industrialization.' },
  { source_name: 'Bolshevik Journal (1923)', source_id: 'bolshevik-journal-1923', date: '1923-10-15', main: 'Left Opposition', target: 'Party Bureaucracy', rel: 'Opposes / Blames', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Critical', quote: 'The Declaration of the 46 denounces bureaucratic stagnation in party organs.' },
  { source_name: 'Bolshevik Journal (1923)', source_id: 'bolshevik-journal-1923', date: '1923-10-15', main: 'Left Opposition', target: 'Nikolai Bukharin', rel: 'Opposes / Blames', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Critical', quote: 'Preobrazhensky and Trotsky reject Bukharins slow agrarian pace.' },
  { source_name: 'Bolshevik Journal (1923)', source_id: 'bolshevik-journal-1923', date: '1923-10-15', main: 'Left Opposition', target: 'Kulaks', rel: 'Opposes / Blames', frame: 'SOCIAL STRATIFICATION AND CLASS FORMATION', tone: 'Alarmed', quote: 'Left Opposition warns of dangerous kulak enrichment in rural Soviets.' },

  // Pravda Special Issue (1924)
  { source_name: 'Pravda Special Issue (1924)', source_id: 'pravda-special-1924', date: '1924-01-25', main: 'Joseph Stalin', target: 'Party Bureaucracy', rel: 'Belongs To', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Objective', quote: 'General Secretary Stalin leverages party secretariats to consolidate administrative control.' },
  { source_name: 'Pravda Special Issue (1924)', source_id: 'pravda-special-1924', date: '1924-01-25', main: 'Joseph Stalin', target: 'Nikolai Bukharin', rel: 'Supports / Allies', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Sympathetic', quote: 'Stalin aligns with Bukharin to form the ruling duumvirate against Trotsky.' },
  { source_name: 'Pravda Special Issue (1924)', source_id: 'pravda-special-1924', date: '1924-01-25', main: 'Joseph Stalin', target: 'Leon Trotsky', rel: 'Opposes / Blames', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Critical', quote: 'Stalin launches anti-Trotsky campaign warning of Bonapartism.' },
  { source_name: 'Pravda Special Issue (1924)', source_id: 'pravda-special-1924', date: '1924-01-25', main: 'Old Bolsheviks', target: 'Party Bureaucracy', rel: 'Belongs To', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Objective', quote: 'Veteran revolutionaries from 1917 occupy senior positions in the Politburo.' },
  { source_name: 'Pravda Special Issue (1924)', source_id: 'pravda-special-1924', date: '1924-01-25', main: 'Leon Trotsky', target: 'Joseph Stalin', rel: 'Opposes / Blames', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Critical', quote: 'Trotsky publishes Lessons of October criticizing party apparatus maneuvering.' },
  { source_name: 'Pravda Special Issue (1924)', source_id: 'pravda-special-1924', date: '1924-01-25', main: 'Nikolai Bukharin', target: 'New Economic Policy', rel: 'Supports / Allies', frame: 'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', tone: 'Sympathetic', quote: 'Bukharin theorizes that Soviet socialism can be reached through NEP market evolution.' },
  { source_name: 'Pravda Special Issue (1924)', source_id: 'pravda-special-1924', date: '1924-01-25', main: 'Joseph Stalin', target: 'New Economic Policy', rel: 'Supports / Allies', frame: 'STATE CAPITALISM', tone: 'Objective', quote: 'Stalin initially defends NEP stability during Lenin successor transition.' },

  // Krasnaya Gazeta (1925)
  { source_name: 'Krasnaya Gazeta (1925)', source_id: 'krasnaya-gazeta-1925', date: '1925-04-17', main: 'Nikolai Bukharin', target: 'Peasantry', rel: 'Supports / Allies', frame: 'URBAN VS. RURAL DIVIDE', tone: 'Sympathetic', quote: 'Our slogan to the peasantry must be: Enrich yourselves, grow your holdings.' },
  { source_name: 'Krasnaya Gazeta (1925)', source_id: 'krasnaya-gazeta-1925', date: '1925-04-17', main: 'Nikolai Bukharin', target: 'Kulaks', rel: 'Supports / Allies', frame: 'SOCIAL STRATIFICATION AND CLASS FORMATION', tone: 'Objective', quote: 'Even prosperous peasants (kulaks) contribute to the national grain surplus.' },
  { source_name: 'Krasnaya Gazeta (1925)', source_id: 'krasnaya-gazeta-1925', date: '1925-04-17', main: 'Nikolai Bukharin', target: 'Right Opposition', rel: 'Belongs To', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Objective', quote: 'Bukharin, Rykov, and Tomsky represent the moderate Right Opposition trend.' },
  { source_name: 'Krasnaya Gazeta (1925)', source_id: 'krasnaya-gazeta-1925', date: '1925-04-17', main: 'Right Opposition', target: 'Left Opposition', rel: 'Opposes / Blames', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Critical', quote: 'Right wing theoreticians denounce super-industrializers as economic adventurists.' },
  { source_name: 'Krasnaya Gazeta (1925)', source_id: 'krasnaya-gazeta-1925', date: '1925-04-17', main: 'Kulaks', target: 'NEPmen', rel: 'Funds / Finances', frame: 'SOCIAL STRATIFICATION AND CLASS FORMATION', tone: 'Objective', quote: 'Kulak grain sales finance urban NEPmen commerce and private trading networks.' },
  { source_name: 'Krasnaya Gazeta (1925)', source_id: 'krasnaya-gazeta-1925', date: '1925-04-17', main: 'Right Opposition', target: 'New Economic Policy', rel: 'Supports / Allies', frame: 'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', tone: 'Sympathetic', quote: 'The Right Opposition maintains NEP as the permanent path to socialist building.' },

  // Soviet Economic Review (1926)
  { source_name: 'Soviet Economic Review (1926)', source_id: 'soviet-economic-review-1926', date: '1926-08-30', main: 'Foreign Concessionaires', target: 'State Capitalism', rel: 'Funds / Finances', frame: 'STATE CAPITALISM', tone: 'Objective', quote: 'Western capital investments and mining concessions provide crucial hard currency.' },
  { source_name: 'Soviet Economic Review (1926)', source_id: 'soviet-economic-review-1926', date: '1926-08-30', main: 'State Capitalism', target: 'New Economic Policy', rel: 'Supports / Allies', frame: 'STATE CAPITALISM', tone: 'Objective', quote: 'Leninist state capitalism provides the legal structure governing NEP.' },
  { source_name: 'Soviet Economic Review (1926)', source_id: 'soviet-economic-review-1926', date: '1926-08-30', main: 'Foreign Concessionaires', target: 'Gosplan', rel: 'Influences / Controls', frame: 'STATE CAPITALISM', tone: 'Objective', quote: 'State planning committees negotiate technology import contracts with foreign firms.' },
  { source_name: 'Soviet Economic Review (1926)', source_id: 'soviet-economic-review-1926', date: '1926-08-30', main: 'Red Army', target: 'Party Bureaucracy', rel: 'Supports / Allies', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Objective', quote: 'Military leadership maintains loyalty to the ruling Party Central Committee.' },
  { source_name: 'Soviet Economic Review (1926)', source_id: 'soviet-economic-review-1926', date: '1926-08-30', main: 'Socialist Revolutionaries', target: 'Vladimir Lenin', rel: 'Opposes / Blames', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Critical', quote: 'SR remnants condemn Bolshevik single-party monopoly.' },

  // Opposition Platform (1927)
  { source_name: 'Opposition Platform (1927)', source_id: 'opposition-platform-1927', date: '1927-09-03', main: 'Left Opposition', target: 'NEPmen', rel: 'Opposes / Blames', frame: 'SOCIAL STRATIFICATION AND CLASS FORMATION', tone: 'Alarmed', quote: 'Bourgeois NEPmen are siphoning state industrial profits into private coffers.' },
  { source_name: 'Opposition Platform (1927)', source_id: 'opposition-platform-1927', date: '1927-09-03', main: 'Left Opposition', target: 'Industrial Proletariat', rel: 'Incites / Mobilizes', frame: 'SOCIAL STRATIFICATION AND CLASS FORMATION', tone: 'Sympathetic', quote: 'Factory workers must mobilize against wage cuts and secretarial dictatorship.' },
  { source_name: 'Opposition Platform (1927)', source_id: 'opposition-platform-1927', date: '1927-09-03', main: 'Party Bureaucracy', target: 'Left Opposition', rel: 'Opposes / Blames', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Critical', quote: 'The Central Committee expels Trotsky and Zinoviev for factional breach.' },
  { source_name: 'Opposition Platform (1927)', source_id: 'opposition-platform-1927', date: '1927-09-03', main: 'Party Bureaucracy', target: 'Cheka / OGPU', rel: 'Influences / Controls', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Objective', quote: 'Security apparatus arrests underground opposition printing presses.' },

  // Pravda Editorial (1928)
  { source_name: 'Pravda Editorial (1928)', source_id: 'pravda-editorial-1928', date: '1928-11-20', main: 'Joseph Stalin', target: 'Nikolai Bukharin', rel: 'Opposes / Blames', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Critical', quote: 'Bukharins right-deviation represents capitalist restoration in agriculture.' },
  { source_name: 'Pravda Editorial (1928)', source_id: 'pravda-editorial-1928', date: '1928-11-20', main: 'Joseph Stalin', target: 'Right Opposition', rel: 'Opposes / Blames', frame: 'INTRA-PARTY FACTIONALISM', tone: 'Critical', quote: 'Right-wing conciliators are unmasked as defenders of kulak hoarding.' },
  { source_name: 'Pravda Editorial (1928)', source_id: 'pravda-editorial-1928', date: '1928-11-20', main: 'Joseph Stalin', target: 'Gosplan', rel: 'Influences / Controls', frame: 'STATE CAPITALISM', tone: 'Objective', quote: 'Stalin orders Gosplan to draft maximum targets for heavy industry.' },
  { source_name: 'Pravda Editorial (1928)', source_id: 'pravda-editorial-1928', date: '1928-11-20', main: 'Gosplan', target: 'Industrial Proletariat', rel: 'Incites / Mobilizes', frame: 'STATE CAPITALISM', tone: 'Objective', quote: 'Five-Year Plan mobilizes millions of workers for tractor plant construction.' },
  { source_name: 'Pravda Editorial (1928)', source_id: 'pravda-editorial-1928', date: '1928-11-20', main: 'New Economic Policy', target: 'Party Bureaucracy', rel: 'Opposes / Blames', frame: 'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', tone: 'Critical', quote: 'NEP market forces inevitably clash with central state administration goals.' }
];

const EXAMPLE_ARTICLES = RAW_RELATIONS.map((r, i) => ({
  id: `nep-art-${i + 1}`,
  projectId: 'example-nep-1921',
  source_name: r.source_name,
  source_id: r.source_id,
  headline: `"${r.quote.substring(0, 65)}..."`,
  date: r.date,
  url: `https://archives.gov/${r.source_id}`,
  isProcessed: true,
  actors: { main_actor: r.main, blame_target: r.target },
  frames: [r.frame],
  tone: r.tone,
  relation_type: r.rel,
  quote: r.quote,
  rationale: `${r.main} -> ${r.rel} -> ${r.target}`
}));

export const useStore = create(
  persist(
    (set, get) => ({
      // API Settings - Default to FreeLLMAPI
      apiConfig: {
        provider: 'freellmapi',
        baseUrl: 'http://localhost:8000/v1/chat/completions',
        apiKey: 'freellmapi-96146ee70cfe916f131303a9dee491c45f5c979f6e9fe93c',
        model: 'auto',
        customSystemPrompt: ''
      },
      setApiConfig: (config) => set({ apiConfig: { ...get().apiConfig, ...config } }),

      // Projects
      projects: [EXAMPLE_PROJECT], 
      activeProjectId: null,
      
      createProject: (projectData) => set((state) => {
        const newProject = { id: uuidv4(), createdAt: new Date().toISOString(), ...projectData };
        return { projects: [...state.projects, newProject], activeProjectId: newProject.id };
      }),
      setActiveProject: (id) => set({ activeProjectId: id }),
      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      deleteProject: (id) => set((state) => ({ 
        projects: state.projects.filter(p => p.id !== id),
        articles: state.articles.filter(a => a.projectId !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId
      })),

      // Articles - pre-seeded with full 49 EXAMPLE_ARTICLES dataset
      articles: EXAMPLE_ARTICLES, 
      
      addArticle: (articleData) => set((state) => ({
        articles: [...state.articles, { id: uuidv4(), isProcessed: false, ...articleData }]
      })),
      
      updateArticle: (id, updates) => set((state) => ({
        articles: state.articles.map(a => a.id === id ? { ...a, ...updates } : a)
      })),
      
      deleteArticle: (id) => set((state) => ({
        articles: state.articles.filter(a => a.id !== id)
      })),

      initializeFromDatabase: () => set((state) => {
        let updatedProjects = state.projects || [];
        let updatedArticles = state.articles || [];
        
        // Ensure the original example project (New Economic Policy) is always present
        const hasExample = updatedProjects.some(p => p.id === EXAMPLE_PROJECT.id || p.name === 'New Economic Policy (1921-1928)');
        if (!hasExample) {
          updatedProjects = [EXAMPLE_PROJECT, ...updatedProjects];
        } else {
          updatedProjects = updatedProjects.map(p => 
            (p.name === 'New Economic Policy (1921-1928)' && !p.isExample) 
              ? { ...p, isExample: true } 
              : p
          );
        }
        
        // Ensure example project has all 49 historical articles
        const exampleArticlesCount = updatedArticles.filter(a => a.projectId === EXAMPLE_PROJECT.id).length;
        if (exampleArticlesCount < EXAMPLE_ARTICLES.length) {
          const otherArticles = updatedArticles.filter(a => a.projectId !== EXAMPLE_PROJECT.id);
          updatedArticles = [...otherArticles, ...EXAMPLE_ARTICLES];
        }

        return { projects: updatedProjects, articles: updatedArticles };
      }),
      
      loadExampleProject: () => set((state) => {
        const hasExample = state.projects.some(p => p.id === EXAMPLE_PROJECT.id || p.name === 'New Economic Policy (1921-1928)');
        let updatedProjects = state.projects;
        if (!hasExample) {
          updatedProjects = [EXAMPLE_PROJECT, ...state.projects];
        }

        const otherArticles = state.articles.filter(a => a.projectId !== EXAMPLE_PROJECT.id);
        const updatedArticles = [...otherArticles, ...EXAMPLE_ARTICLES];

        return { projects: updatedProjects, articles: updatedArticles };
      }),
    }),
    {
      name: 'Trace-workspace',
    }
  )
)
