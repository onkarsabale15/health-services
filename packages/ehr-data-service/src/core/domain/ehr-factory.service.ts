import { IEhrService } from '../interfaces/ehr-service.interface';
import { AppError } from '../errors/app.error';

class EhrFactoryService {
  private vendors: Map<string, IEhrService> = new Map();

  register(ehrName: string, service: IEhrService): void {
    this.vendors.set(ehrName.toLowerCase(), service);
  }

  getService(ehrName: string): IEhrService {
    const service = this.vendors.get(ehrName.toLowerCase());
    if (!service) {
      throw new AppError(400, `Unsupported EHR provider: ${ehrName}`);
    }
    return service;
  }

  getSupportedVendors(): string[] {
    return Array.from(this.vendors.keys());
  }
}

export const ehrFactory = new EhrFactoryService();
