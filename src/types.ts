export interface HabitTrackerSettings {
  habitsFilePath: string;
}

export interface HabitData {
  habits?: string[];
  [habitName: string]: {
    [date: string]: boolean;
  } | string[] | undefined;
}

export const DEFAULT_SETTINGS: HabitTrackerSettings = {
  habitsFilePath: 'habits.md'
};
