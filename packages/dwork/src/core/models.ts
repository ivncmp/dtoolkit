import { z } from 'zod';

export const ProjectStatusSchema = z.enum(['active', 'paused', 'archived']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const TaskStatusSchema = z.enum(['todo', 'refinement', 'doing', 'blocked', 'done']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskTypeSchema = z.enum(['task', 'bug', 'feature', 'idea', 'note']);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const PrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);
export type Priority = z.infer<typeof PrioritySchema>;

export const DocTypeSchema = z.enum([
  'readme',
  'tech',
  'roadmap',
  'backlog',
  'note',
  'idea',
  'planning',
  'decision',
  'postmortem',
]);
export type DocType = z.infer<typeof DocTypeSchema>;

export const ProjectSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: ProjectStatusSchema.default('active'),
  path: z.string(),
  source_path: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  project_slug: z.string(),
  title: z.string(),
  type: TaskTypeSchema.default('task'),
  status: TaskStatusSchema.default('todo'),
  priority: PrioritySchema.default('P2'),
  estimate: z.string().optional(),
  deadline: z.string().optional(),
  source: z.string().default('manual'),
  detail_path: z.string().optional(),
  tags: z.string().default('[]'),
  line_number: z.number().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

export const DocSchema = z.object({
  id: z.string(),
  project_slug: z.string(),
  title: z.string(),
  type: DocTypeSchema,
  file_path: z.string(),
  body_hash: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Doc = z.infer<typeof DocSchema>;
