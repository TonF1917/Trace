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
          rationale: 'Lenin criticizes War Communism as unsustainable post-civil war.'
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
          main_actor: 'Vladimir Lenin',
          blame_target: 'Gosplan',
          relation_type: 'Influences / Controls',
          frames: ['STATE CAPITALISM'],
          tone: 'Objective',
          quote: 'Gosplan must regulate market transactions while retaining command over heavy industry.',
          rationale: 'Lenin guides state planning authority.'
        },
        {
          date: '1921-03-15',
          main_actor: 'Workers Opposition',
          blame_target: 'Vladimir Lenin',
          relation_type: 'Opposes / Blames',
          frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY'],
          tone: 'Alarmed',
          quote: 'Reintroducing market mechanisms betrays the socialist goal of the revolution.',
          rationale: 'Left-wing faction accuses Lenin of ideological compromise.'
        },
        {
          date: '1921-03-15',
          main_actor: 'Workers Opposition',
          blame_target: 'Party Bureaucracy',
          relation_type: 'Belongs To',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'Trade unions must manage industry directly rather than bureaucratic appointees.',
          rationale: 'Workers Opposition faction exists within the Bolshevik party.'
        },
        {
          date: '1921-03-15',
          main_actor: 'Industrial Proletariat',
          blame_target: 'Worker Masses',
          relation_type: 'Belongs To',
          frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION'],
          tone: 'Objective',
          quote: 'Urban industrial workers form the ideological core of the proletarian state.',
          rationale: 'Industrial proletariat belongs to broader worker masses.'
        }
      ]
    }
  },
  {
    id: 'nep-art-2',
    projectId: 'example-nep-1921',
    source_name: 'Izvestia (1922)',
    source_id: 'izvestia-1922',
    headline: 'Rise of NEPmen and Small Traders in Urban Markets',
    date: '1922-06-20',
    url: 'https://archives.gov/nepmen-1922',
    isProcessed: true,
    actors: { main_actor: 'NEPmen', blame_target: 'Peasantry' },
    frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION', 'URBAN VS. RURAL DIVIDE'],
    tone: 'Objective',
    relation_type: 'Influences / Controls',
    extractedData: {
      relationships: [
        {
          date: '1922-06-20',
          main_actor: 'NEPmen',
          blame_target: 'Peasantry',
          relation_type: 'Influences / Controls',
          frames: ['URBAN VS. RURAL DIVIDE'],
          tone: 'Objective',
          quote: 'Private traders and NEPmen dominate grain procurement in rural markets.',
          rationale: 'Market intermediaries grow in rural economies.'
        },
        {
          date: '1922-06-20',
          main_actor: 'NEPmen',
          blame_target: 'State Capitalism',
          relation_type: 'Belongs To',
          frames: ['STATE CAPITALISM'],
          tone: 'Objective',
          quote: 'Private retail capital flourishes under the umbrella of regulated state capitalism.',
          rationale: 'NEPmen represent the private sector under state capitalism.'
        },
        {
          date: '1922-06-20',
          main_actor: 'NEPmen',
          blame_target: 'Party Bureaucracy',
          relation_type: 'Funds / Finances',
          frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION'],
          tone: 'Critical',
          quote: 'Private traders pay tax duties and license fees directly to state revenue agencies.',
          rationale: 'NEPmen commercial activity funds state administration.'
        },
        {
          date: '1922-06-20',
          main_actor: 'Peasantry',
          blame_target: 'War Communism',
          relation_type: 'Opposes / Blames',
          frames: ['URBAN VS. RURAL DIVIDE'],
          tone: 'Critical',
          quote: 'Peasants welcome the end of forced requisitioning (prodrazverstka).',
          rationale: 'Peasantry rejoices over the repeal of war communism.'
        },
        {
          date: '1922-06-20',
          main_actor: 'Peasantry',
          blame_target: 'New Economic Policy',
          relation_type: 'Supports / Allies',
          frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY'],
          tone: 'Sympathetic',
          quote: 'Farmers respond enthusiastically to the fixed tax-in-kind system.',
          rationale: 'Peasantry supports market-oriented reforms.'
        },
        {
          date: '1922-06-20',
          main_actor: 'Cheka / OGPU',
          blame_target: 'NEPmen',
          relation_type: 'Influences / Controls',
          frames: ['STATE CAPITALISM'],
          tone: 'Alarmed',
          quote: 'State security organs monitor private merchants for illegal speculation.',
          rationale: 'Soviet security oversees NEPmen commercial activities.'
        }
      ]
    }
  },
  {
    id: 'nep-art-3',
    projectId: 'example-nep-1921',
    source_name: 'Bolshevik Journal (1923)',
    source_id: 'bolshevik-journal-1923',
    headline: 'The Scissor Crisis & Industrial Price Inflation',
    date: '1923-10-15',
    url: 'https://archives.gov/scissors-1923',
    isProcessed: true,
    actors: { main_actor: 'Scissors Crisis', blame_target: 'Peasantry' },
    frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY', 'URBAN VS. RURAL DIVIDE'],
    tone: 'Alarmed',
    relation_type: 'Opposes / Blames',
    extractedData: {
      relationships: [
        {
          date: '1923-10-15',
          main_actor: 'Scissors Crisis',
          blame_target: 'Peasantry',
          relation_type: 'Opposes / Blames',
          frames: ['URBAN VS. RURAL DIVIDE'],
          tone: 'Alarmed',
          quote: 'High industrial goods prices discourage peasants from selling surplus grain to cities.',
          rationale: 'Economic gap between industrial and agricultural prices hurts rural farmers.'
        },
        {
          date: '1923-10-15',
          main_actor: 'Scissors Crisis',
          blame_target: 'Industrial Proletariat',
          relation_type: 'Opposes / Blames',
          frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY'],
          tone: 'Critical',
          quote: 'High manufactured goods prices threaten factory employment and real worker wages.',
          rationale: 'Price mismatch depresses urban living standards.'
        },
        {
          date: '1923-10-15',
          main_actor: 'Leon Trotsky',
          blame_target: 'Scissors Crisis',
          relation_type: 'Opposes / Blames',
          frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY'],
          tone: 'Alarmed',
          quote: 'Trotsky demonstrates the widening price scissors at the 12th Party Congress.',
          rationale: 'Trotsky demands rapid state intervention to close the price scissors.'
        },
        {
          date: '1923-10-15',
          main_actor: 'Leon Trotsky',
          blame_target: 'Left Opposition',
          relation_type: 'Belongs To',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Objective',
          quote: 'Trotsky leads the Left Opposition platform advocating rapid industrialization.',
          rationale: 'Trotsky is the principal leader of the Left Opposition.'
        },
        {
          date: '1923-10-15',
          main_actor: 'Left Opposition',
          blame_target: 'Party Bureaucracy',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'The Declaration of the 46 denounces bureaucratic stagnation in party organs.',
          rationale: 'Left Opposition attacks administrative bureaucracy.'
        },
        {
          date: '1923-10-15',
          main_actor: 'Left Opposition',
          blame_target: 'Nikolai Bukharin',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'Preobrazhensky and Trotsky reject Bukharins slow agrarian pace.',
          rationale: 'Left Opposition challenges Bukharin industrial policy.'
        }
      ]
    }
  },
  {
    id: 'nep-art-4',
    projectId: 'example-nep-1921',
    source_name: 'Pravda Special Issue (1924)',
    source_id: 'pravda-special-1924',
    headline: 'Death of Lenin & Factional Struggle for Succession',
    date: '1924-01-25',
    url: 'https://archives.gov/succession-1924',
    isProcessed: true,
    actors: { main_actor: 'Joseph Stalin', blame_target: 'Leon Trotsky' },
    frames: ['INTRA-PARTY FACTIONALISM'],
    tone: 'Critical',
    relation_type: 'Opposes / Blames',
    extractedData: {
      relationships: [
        {
          date: '1924-01-25',
          main_actor: 'Joseph Stalin',
          blame_target: 'Party Bureaucracy',
          relation_type: 'Belongs To',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Objective',
          quote: 'General Secretary Stalin leverages party secretariats to consolidate administrative control.',
          rationale: 'Stalin operates as leader of party apparatus.'
        },
        {
          date: '1924-01-25',
          main_actor: 'Joseph Stalin',
          blame_target: 'Nikolai Bukharin',
          relation_type: 'Supports / Allies',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Sympathetic',
          quote: 'Stalin aligns with Bukharin to form the ruling duumvirate against Trotsky.',
          rationale: 'Triumvirate/alliance formed between Stalin and Bukharin.'
        },
        {
          date: '1924-01-25',
          main_actor: 'Joseph Stalin',
          blame_target: 'Leon Trotsky',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'Stalin launches anti-Trotsky campaign warning of Bonapartism.',
          rationale: 'Stalin seeks to isolate Trotsky politically.'
        },
        {
          date: '1924-01-25',
          main_actor: 'Old Bolsheviks',
          blame_target: 'Party Bureaucracy',
          relation_type: 'Belongs To',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Objective',
          quote: 'Veteran revoluntionaries from 1917 occupy senior positions in the Politburo.',
          rationale: 'Old Bolsheviks constitute the party leadership.'
        },
        {
          date: '1924-01-25',
          main_actor: 'Leon Trotsky',
          blame_target: 'Joseph Stalin',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'Trotsky publishes Lessons of October criticizing party apparatus maneuvering.',
          rationale: 'Trotsky attacks Stalin secretarial hegemony.'
        },
        {
          date: '1924-01-25',
          main_actor: 'Nikolai Bukharin',
          blame_target: 'New Economic Policy',
          relation_type: 'Supports / Allies',
          frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY'],
          tone: 'Sympathetic',
          quote: 'Bukharin theorizes that Soviet socialism can be reached through NEP market evolution.',
          rationale: 'Bukharin provides economic theory supporting NEP.'
        }
      ]
    }
  },
  {
    id: 'nep-art-5',
    projectId: 'example-nep-1921',
    source_name: 'Krasnaya Gazeta (1925)',
    source_id: 'krasnaya-gazeta-1925',
    headline: 'Bukharin Agrarian Thesis: Enrich Yourselves',
    date: '1925-04-17',
    url: 'https://archives.gov/enrich-1925',
    isProcessed: true,
    actors: { main_actor: 'Nikolai Bukharin', blame_target: 'Peasantry' },
    frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION', 'URBAN VS. RURAL DIVIDE'],
    tone: 'Sympathetic',
    relation_type: 'Supports / Allies',
    extractedData: {
      relationships: [
        {
          date: '1925-04-17',
          main_actor: 'Nikolai Bukharin',
          blame_target: 'Peasantry',
          relation_type: 'Supports / Allies',
          frames: ['URBAN VS. RURAL DIVIDE'],
          tone: 'Sympathetic',
          quote: 'Our slogan to the peasantry must be: Enrich yourselves, grow your holdings.',
          rationale: 'Bukharin advocates for peasant agricultural growth.'
        },
        {
          date: '1925-04-17',
          main_actor: 'Nikolai Bukharin',
          blame_target: 'Kulaks',
          relation_type: 'Supports / Allies',
          frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION'],
          tone: 'Objective',
          quote: 'Even prosperous peasants (kulaks) contribute to the national grain surplus.',
          rationale: 'Bukharin defends rich peasant agricultural production.'
        },
        {
          date: '1925-04-17',
          main_actor: 'Nikolai Bukharin',
          blame_target: 'Right Opposition',
          relation_type: 'Belongs To',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Objective',
          quote: 'Bukharin, Rykov, and Tomsky represent the moderate Right Opposition trend.',
          rationale: 'Bukharin is ideologue of the Right Opposition.'
        },
        {
          date: '1925-04-17',
          main_actor: 'Kulaks',
          blame_target: 'Peasantry',
          relation_type: 'Belongs To',
          frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION'],
          tone: 'Objective',
          quote: 'Kulaks form the wealthy upper strata of rural agrarian society.',
          rationale: 'Kulaks belong to the broader peasantry.'
        },
        {
          date: '1925-04-17',
          main_actor: 'Right Opposition',
          blame_target: 'Left Opposition',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'Right wing theoreticians denounce super-industrializers as economic adventurists.',
          rationale: 'Right Opposition opposes Left Opposition policies.'
        },
        {
          date: '1925-04-17',
          main_actor: 'Kulaks',
          blame_target: 'NEPmen',
          relation_type: 'Funds / Finances',
          frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION'],
          tone: 'Objective',
          quote: 'Kulak grain sales finance urban NEPmen commerce and private trading networks.',
          rationale: 'Wealthy peasants trade with urban NEPmen.'
        }
      ]
    }
  },
  {
    id: 'nep-art-6',
    projectId: 'example-nep-1921',
    source_name: 'Soviet Economic Review (1926)',
    source_id: 'soviet-economic-review-1926',
    headline: 'Foreign Trade Monopoly and Concessions Strategy',
    date: '1926-08-30',
    url: 'https://archives.gov/trade-1926',
    isProcessed: true,
    actors: { main_actor: 'Foreign Concessionaires', blame_target: 'State Capitalism' },
    frames: ['STATE CAPITALISM', 'ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY'],
    tone: 'Objective',
    relation_type: 'Funds / Finances',
    extractedData: {
      relationships: [
        {
          date: '1926-08-30',
          main_actor: 'Foreign Concessionaires',
          blame_target: 'State Capitalism',
          relation_type: 'Funds / Finances',
          frames: ['STATE CAPITALISM'],
          tone: 'Objective',
          quote: 'Western capital investments and mining concessions provide crucial hard currency.',
          rationale: 'Foreign firms finance Soviet state capital development.'
        },
        {
          date: '1926-08-30',
          main_actor: 'State Capitalism',
          blame_target: 'New Economic Policy',
          relation_type: 'Supports / Allies',
          frames: ['STATE CAPITALISM'],
          tone: 'Objective',
          quote: 'Leninist state capitalism provides the legal structure governing NEP.',
          rationale: 'State capitalism supports NEP framework.'
        },
        {
          date: '1926-08-30',
          main_actor: 'Foreign Concessionaires',
          blame_target: 'Gosplan',
          relation_type: 'Influences / Controls',
          frames: ['STATE CAPITALISM'],
          tone: 'Objective',
          quote: 'State planning committees negotiate technology import contracts with foreign firms.',
          rationale: 'Concessionaires interact with Gosplan state planners.'
        },
        {
          date: '1926-08-30',
          main_actor: 'Red Army',
          blame_target: 'Party Bureaucracy',
          relation_type: 'Supports / Allies',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Objective',
          quote: 'Military leadership maintains loyalty to the ruling Party Central Committee.',
          rationale: 'Red Army supports Party leadership.'
        },
        {
          date: '1926-08-30',
          main_actor: 'Socialist Revolutionaries',
          blame_target: 'Vladimir Lenin',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'SR remnants condemn Bolshevik single-party monopoly.',
          rationale: 'Socialist Revolutionaries oppose Lenin party dictatorship.'
        }
      ]
    }
  },
  {
    id: 'nep-art-7',
    projectId: 'example-nep-1921',
    source_name: 'Opposition Platform (1927)',
    source_id: 'opposition-platform-1927',
    headline: 'United Opposition Manifesto: Defense of Proletarian Dictatorship',
    date: '1927-09-03',
    url: 'https://archives.gov/platform-1927',
    isProcessed: true,
    actors: { main_actor: 'Left Opposition', blame_target: 'Kulaks' },
    frames: ['INTRA-PARTY FACTIONALISM', 'SOCIAL STRATIFICATION AND CLASS FORMATION'],
    tone: 'Alarmed',
    relation_type: 'Opposes / Blames',
    extractedData: {
      relationships: [
        {
          date: '1927-09-03',
          main_actor: 'Left Opposition',
          blame_target: 'Kulaks',
          relation_type: 'Opposes / Blames',
          frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION'],
          tone: 'Alarmed',
          quote: 'The kulak threat in the countryside endangers Soviet power and grain supplies.',
          rationale: 'Left Opposition calls for class struggle against kulaks.'
        },
        {
          date: '1927-09-03',
          main_actor: 'Left Opposition',
          blame_target: 'NEPmen',
          relation_type: 'Opposes / Blames',
          frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION'],
          tone: 'Alarmed',
          quote: 'Bourgeois NEPmen are siphoning state industrial profits into private coffers.',
          rationale: 'Left Opposition demands crackdown on private traders.'
        },
        {
          date: '1927-09-03',
          main_actor: 'Left Opposition',
          blame_target: 'Industrial Proletariat',
          relation_type: 'Incites / Mobilizes',
          frames: ['SOCIAL STRATIFICATION AND CLASS FORMATION'],
          tone: 'Sympathetic',
          quote: 'Factory workers must mobilize against wage cuts and secretarial dictatorship.',
          rationale: 'Left Opposition rallies industrial workers.'
        },
        {
          date: '1927-09-03',
          main_actor: 'Party Bureaucracy',
          blame_target: 'Left Opposition',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'The Central Committee expels Trotsky and Zinoviev for factional breach.',
          rationale: 'Party machinery purges opposition leaders.'
        },
        {
          date: '1927-09-03',
          main_actor: 'Party Bureaucracy',
          blame_target: 'Cheka / OGPU',
          relation_type: 'Influences / Controls',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Objective',
          quote: 'Security apparatus arrests underground opposition printing presses.',
          rationale: 'Party bureaucracy utilizes state security organs.'
        }
      ]
    }
  },
  {
    id: 'nep-art-8',
    projectId: 'example-nep-1921',
    source_name: 'Pravda Editorial (1928)',
    source_id: 'pravda-editorial-1928',
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
          quote: 'The grain procurement crisis proves NEP can no longer supply socialist industrialization.',
          rationale: 'Stalin declares the end of NEP.'
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
          main_actor: 'Joseph Stalin',
          blame_target: 'Right Opposition',
          relation_type: 'Opposes / Blames',
          frames: ['INTRA-PARTY FACTIONALISM'],
          tone: 'Critical',
          quote: 'Right-wing conciliators are unmasked as defenders of kulak hoarding.',
          rationale: 'Stalin breaks the moderate Right faction.'
        },
        {
          date: '1928-11-20',
          main_actor: 'Joseph Stalin',
          blame_target: 'Gosplan',
          relation_type: 'Influences / Controls',
          frames: ['STATE CAPITALISM'],
          tone: 'Objective',
          quote: 'Stalin orders Gosplan to draft maximum targets for heavy industry.',
          rationale: 'Stalin takes control of planning apparatus.'
        },
        {
          date: '1928-11-20',
          main_actor: 'Gosplan',
          blame_target: 'Industrial Proletariat',
          relation_type: 'Incites / Mobilizes',
          frames: ['STATE CAPITALISM'],
          tone: 'Objective',
          quote: 'Five-Year Plan mobilizes millions of workers for tractor plant construction.',
          rationale: 'Gosplan directs worker mobilization.'
        },
        {
          date: '1928-11-20',
          main_actor: 'New Economic Policy',
          blame_target: 'Party Bureaucracy',
          relation_type: 'Opposes / Blames',
          frames: ['ECONOMIC RECOVERY VS. IDEOLOGICAL PURITY'],
          tone: 'Critical',
          quote: 'NEP market forces inevitably clash with central state administration goals.',
          rationale: 'Structural contradiction between NEP and party administration.'
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

      // Articles - pre-seeded with full EXAMPLE_ARTICLES dataset
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
        
        // Ensure example project has all historical articles if missing or incomplete
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
