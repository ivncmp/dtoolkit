export interface TemplateVariable {
  name: string;
  source?: "stdin" | "arg" | "flag";
  required?: boolean;
  default?: string;
}

export interface TemplateDefinition {
  name: string;
  description?: string;
  prompt: string;
  variables?: TemplateVariable[];
  claudeOptions?: Partial<{
    model: string;
    maxTurns: number;
    maxBudgetUsd: number;
  }>;
}
