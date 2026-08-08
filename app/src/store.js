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

const EXAMPLE_ARTICLES = [
  {
    id: 'nep-art-1',
    projectId: 'example-nep-1921',
    source_name: 'Pravda Archives (1921)',
    source_id: 'pravda-archives-1921',
    headline: 'Lenin Proposes the New Economic Policy at 10th Party Congress',
    date: '1921-03-15',
    url: 'https://archives.gov/nep-1921',
    isProcessed: true,
    actors: { main_actor: 'Vladimir Lenin', blame_target: 'War Communism' },
    frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', 'STATE CAPITALISM'],
    tone: 'Critical',
    relation_type: 'Opposes / Blames',
    extractedData: {
      relationships: [
        {
          date: '1921-03-15',
          main_actor: 'Vladimir Lenin',
          blame_target: 'War Communism',
          relation_type: 'Opposes / Blames',
          frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY'],
          tone: 'Critical',
          quote: 'War communism was imposed by war and ruin. It was not, nor could it be, a policy that corresponded to economic tasks.',
          rationale: 'Lenin criticizes War Communism as unsustainable.'
        },
        {
          date: '1921-03-15',
          main_actor: 'Vladimir Lenin',
          blame_target: 'New Economic Policy',
          relation_type: 'Supports / Allies',
          frames: ['STATE CAPITALISM'],
          tone: 'Objective',
          quote: 'We must allow a degree of free trade and private enterprise to restore agricultural output.',
          rationale: 'Lenin champions the NEP as necessary state capitalism.'
        },
        {
          date: '1921-03-15',
          main_actor: 'Workers Opposition',
          blame_target: 'Vladimir Lenin',
          relation_type: 'Opposes / Blames',
          frames: ['IDEOLOGICAL PURITY'],
          tone: 'Alarmed',
          quote: 'Reintroducing market mechanisms betrays the socialist goal of the revolution.',
          rationale: 'Left-wing faction accuses Lenin of ideological betrayal.'
        }
      ]
    }
  },
  {
    id: 'nep-art-2',
    projectId: 'example-nep-1921',
    source_name: 'Izvestia (1923)',
    source_id: 'izvestia-1923',
    headline: 'Bukharin Advocates Peasant Enrichment and NEP Expansion',
    date: '1923-04-12',
    url: 'https://archives.gov/bukharin-1923',
    isProcessed: true,
    actors: { main_actor: 'Nikolai Bukharin', blame_target: 'Left Opposition' },
    frames: ['INTRA-PARTY FACTIONALISM', 'URBAN VS. RURAL DIVIDE'],
    tone: 'Sympathetic',
    relation_type: 'Opposes / Blames',
    extractedData: {
      relationships: [
        {
          date: '1923-04-12',
          main_actor: 'Nikolai Bukharin',
          blame_target: 'Left Opposition',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'Preobrazhensky and Trotsky wish to exploit the peasantry like an internal colony.',
          rationale: 'Bukharin defends the peasantry against heavy industrial taxation.'
        },
        {
          date: '1923-04-12',
          main_actor: 'Nikolai Bukharin',
          blame_target: 'Peasantry',
          relation_type: 'Supports / Allies',
          frames: ['URBAN VS. RURAL DIVIDE'],
          tone: 'Sympathetic',
          quote: 'Enrich yourselves, develop your farms, and do not fear restriction.',
          rationale: 'Bukharin encourages agricultural prosperity.'
        },
        {
          date: '1923-04-12',
          main_actor: 'NEPmen',
          blame_target: 'Peasantry',
          relation_type: 'Influences / Controls',
          frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION'],
          tone: 'Objective',
          quote: 'Private traders and NEPmen dominate grain procurement in rural markets.',
          rationale: 'Market intermediaries grow in rural economies.'
        }
      ]
    }
  },
  {
    id: 'nep-art-3',
    projectId: 'example-nep-1921',
    source_name: 'Bulletin of the Opposition (1926)',
    source_id: 'bulletin-opposition-1926',
    headline: 'Trotsky Warns Against Scissor Crisis and Kulak Growth',
    date: '1926-10-08',
    url: 'https://archives.gov/trotsky-1926',
    isProcessed: true,
    actors: { main_actor: 'Leon Trotsky', blame_target: 'Nikolai Bukharin' },
    frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION', 'INTRA-PARTY FACTIONALISM'],
    tone: 'Alarmed',
    relation_type: 'Opposes / Blames',
    extractedData: {
      relationships: [
        {
          date: '1926-10-08',
          main_actor: 'Leon Trotsky',
          blame_target: 'Nikolai Bukharin',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Alarmed',
          quote: 'Bukharins right-wing policy is allowing rich peasants (Kulaks) to threaten Soviet power.',
          rationale: 'Trotsky warns against kulak economic dominance.'
        },
        {
          date: '1926-10-08',
          main_actor: 'Leon Trotsky',
          blame_target: 'Gosplan',
          relation_type: 'Influences / Controls',
          frames: ['STATE CAPITALISM'],
          tone: 'Objective',
          quote: 'State planning must prioritize rapid industrialization over capitalist market forces.',
          rationale: 'Trotsky demands rapid industrial planning via Gosplan.'
        },
        {
          date: '1926-10-08',
          main_actor: 'Joseph Stalin',
          blame_target: 'Leon Trotsky',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'Trotskyism seeks to undermine party unity and break the worker-peasant alliance.',
          rationale: 'Stalin attacks Trotsky for factionalism.'
        }
      ]
    }
  },
  {
    id: 'nep-art-4',
    projectId: 'example-nep-1921',
    source_name: 'Politburo Minutes (1928)',
    source_id: 'politburo-minutes-1928',
    headline: 'Stalin Abandons NEP and Launches First Five-Year Plan',
    date: '1928-11-20',
    url: 'https://archives.gov/stalin-1928',
    isProcessed: true,
    actors: { main_actor: 'Joseph Stalin', blame_target: 'New Economic Policy' },
    frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', 'STATE CAPITALISM'],
    tone: 'Critical',
    relation_type: 'Opposes / Blames',
    extractedData: {
      relationships: [
        {
          date: '1928-11-20',
          main_actor: 'Joseph Stalin',
          blame_target: 'New Economic Policy',
          relation_type: 'Opposes / Blames',
          frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY'],
          tone: 'Critical',
          quote: 'The grain procurement crisis proves NEP can no longer supply the socialist industrialization effort.',
          rationale: 'Stalin declares the end of NEP in favor of forced collectivization.'
        },
        {
          date: '1928-11-20',
          main_actor: 'Joseph Stalin',
          blame_target: 'Nikolai Bukharin',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'Bukharins right-deviation represents capitalist restoration in agriculture.',
          rationale: 'Stalin purges the Right Opposition.'
        },
        {
          date: '1928-11-20',
          main_actor: 'Gosplan',
          blame_target: 'First Five-Year Plan',
          relation_type: 'Supports / Allies',
          frames: ['STATE CAPITALISM'],
          tone: 'Objective',
          quote: 'Central state allocation will completely replace NEP market trading.',
          rationale: 'Gosplan takes full charge of the command economy.'
        }
      ]
    }
  }
];

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

      // Articles - pre-seeded with EXAMPLE_ARTICLES
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
        
        // Ensure example project has articles if empty
        const hasExampleArticles = updatedArticles.some(a => a.projectId === EXAMPLE_PROJECT.id);
        if (!hasExampleArticles) {
          updatedArticles = [...updatedArticles, ...EXAMPLE_ARTICLES];
        }

        return { projects: updatedProjects, articles: updatedArticles };
      }),
      
      loadExampleProject: () => set((state) => {
        const hasExample = state.projects.some(p => p.id === EXAMPLE_PROJECT.id || p.name === 'New Economic Policy (1921-1928)');
        let updatedProjects = state.projects;
        if (!hasExample) {
          updatedProjects = [EXAMPLE_PROJECT, ...state.projects];
        }

        const hasExampleArticles = state.articles.some(a => a.projectId === EXAMPLE_PROJECT.id);
        let updatedArticles = state.articles;
        if (!hasExampleArticles) {
          updatedArticles = [...state.articles, ...EXAMPLE_ARTICLES];
        }

        return { projects: updatedProjects, articles: updatedArticles };
      }),
    }),
    {
      name: 'Trace-workspace',
    }
  )
)

