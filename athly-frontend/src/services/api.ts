import {
  Configuration,
  AuthApi,
  UsersApi,
  WorkoutsApi,
  TrainingPlansApi,
  WeeklyGoalsApi,
  IntegrationsApi,
  AiPlannerApi,
  EquipmentsApi,
} from '../client'

const BASE_URL = import.meta.env.VITE_BACKEND_API_URL;

class ApiManager {
  private accessToken: string | null = null
  private config: Configuration

  constructor() {
    this.config = this.createConfig()
  }

  private createConfig(): Configuration {
    return new Configuration({
      basePath: BASE_URL,
      accessToken: () => this.accessToken || '',
    })
  }

  setToken(token: string) {
    this.accessToken = token
    this.config = this.createConfig()
    this.updateApis()
  }

  clearToken() {
    this.accessToken = null
    this.config = this.createConfig()
    this.updateApis()
  }

  getToken() {
    return this.accessToken
  }

  // API Instances
  public auth = new AuthApi(this.createConfig())
  public users = new UsersApi(this.createConfig())
  public workouts = new WorkoutsApi(this.createConfig())
  public trainingPlans = new TrainingPlansApi(this.createConfig())
  public weeklyGoals = new WeeklyGoalsApi(this.createConfig())
  public integrations = new IntegrationsApi(this.createConfig())
  public aiPlanner = new AiPlannerApi(this.createConfig())
  public equipments = new EquipmentsApi(this.createConfig())

  private updateApis() {
    const newConfig = this.config
    this.auth = new AuthApi(newConfig)
    this.users = new UsersApi(newConfig)
    this.workouts = new WorkoutsApi(newConfig)
    this.trainingPlans = new TrainingPlansApi(newConfig)
    this.weeklyGoals = new WeeklyGoalsApi(newConfig)
    this.integrations = new IntegrationsApi(newConfig)
    this.aiPlanner = new AiPlannerApi(newConfig)
    this.equipments = new EquipmentsApi(newConfig)
  }
}

export const api = new ApiManager()
