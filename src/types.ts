export interface HabitTrackerSettings {
  habitsFilePath: string;
}

export interface HabitData {
  habits?: string[];
  colors?: { [habitName: string]: string };
  // habit entries map to date->boolean, but allow any for flexibility
  [habitName: string]: any;
}

export const DEFAULT_SETTINGS: HabitTrackerSettings = {
  habitsFilePath: 'habits.md'
};
