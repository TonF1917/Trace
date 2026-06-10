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

export const useStore = create(
  persist(
    (set, get) => ({
      // API Settings
      apiConfig: {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4o-mini'
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

      // Articles
      articles: [], 
      
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
        
        // If somehow projects are completely empty (e.g. wiped), ensure the example project is there
        if (updatedProjects.length === 0) {
          updatedProjects = [EXAMPLE_PROJECT];
        } else {
          // Retroactively flag the user's existing NEP project as an example
          updatedProjects = updatedProjects.map(p => 
            (p.name === 'New Economic Policy (1921-1928)' && !p.isExample) 
              ? { ...p, isExample: true } 
              : p
          );
        }
        
        return { projects: updatedProjects };
      }),
      
      loadExampleProject: () => set((state) => {
        if (!state.projects.find(p => p.id === EXAMPLE_PROJECT.id)) {
          return { projects: [EXAMPLE_PROJECT, ...state.projects] };
        }
        return state;
      }),
    }),
    {
      name: 'Trace-workspace',
    }
  )
)

