import { App, TFile } from 'obsidian';

export class HabitParser {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  async parseHabitsFromFile(filePath: string): Promise<string[]> {
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!file || !(file instanceof TFile)) {
      console.log(`Habits file not found: ${filePath}`);
      return [];
    }

    try {
      const content = await this.app.vault.read(file);
      const habits = this.extractHabits(content);
      return habits;
    } catch (error) {
      console.error('Error reading habits file:', error);
      return [];
    }
  }

  private extractHabits(content: string): string[] {
    const habits: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Support various markdown list formats
      // - [ ] Habit name
      // - Habit name
      // * Habit name
      // 1. Habit name
      const checkboxMatch = trimmedLine.match(/^[-*]\s*\[[ x]\]\s*(.+)$/i);
      const listMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
      const numberedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);

      if (checkboxMatch) {
        habits.push(checkboxMatch[1].trim());
      } else if (listMatch) {
        habits.push(listMatch[1].trim());
      } else if (numberedMatch) {
        habits.push(numberedMatch[1].trim());
      }
    }

    return habits;
  }
}
