import type { ComponentType } from 'react';
import { AgendaPage } from './modules/agenda/AgendaPage';

/**
 * Registro de módulos do app. Para criar um novo módulo, crie a pasta em
 * src/modules/<nome> e adicione uma entrada aqui (sem `soon`).
 */
export interface AppModule {
  id: string;
  label: string;
  icon: string;
  component?: ComponentType;
  soon?: boolean;
}

export const MODULES: AppModule[] = [
  { id: 'agenda', label: 'Agenda', icon: '📅', component: AgendaPage },
  { id: 'gastos', label: 'Gastos', icon: '💰', soon: true },
  { id: 'lembretes', label: 'Lembretes', icon: '📝', soon: true },
];
