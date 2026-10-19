import { DexieLearningRepository, type LearningRepository } from "./repository";

let repository: LearningRepository | undefined;

/** One shared repository per browser tab. Only call from client components. */
export function getRepository(): LearningRepository {
  repository ??= new DexieLearningRepository();
  return repository;
}
