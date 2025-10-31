import { HabitData } from './types';

export class HabitDataStore {
  private data: HabitData = {};
  private saveCallback: () => Promise<void>;

  constructor(saveCallback: () => Promise<void>) {
    this.saveCallback = saveCallback;
  }

  loadData(data: HabitData): void {
    this.data = data || {};
    if (!this.data.habits) {
      this.data.habits = [];
    }
  }

  getData(): HabitData {
    return this.data;
  }

  getHabits(): string[] {
    return this.data.habits || [];
  }

  addHabit(habitName: string): boolean {
    const trimmedName = habitName.trim();
    if (!trimmedName) return false;

    if (!this.data.habits) {
      this.data.habits = [];
    }

    if (this.data.habits.includes(trimmedName)) {
      return false;
    }

    this.data.habits.push(trimmedName);
    this.data[trimmedName] = {};
    this.saveCallback();
    return true;
  }

  removeHabit(habitName: string): boolean {
    if (!this.data.habits) return false;

    const index = this.data.habits.indexOf(habitName);
    if (index === -1) return false;

    this.data.habits.splice(index, 1);
    delete this.data[habitName];
    this.saveCallback();
    return true;
  }

  renameHabit(oldName: string, newName: string): boolean {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || !this.data.habits) return false;

    const index = this.data.habits.indexOf(oldName);
    if (index === -1) return false;

    if (this.data.habits.includes(trimmedNewName)) {
      return false;
    }

    this.data.habits[index] = trimmedNewName;

    if (this.data[oldName]) {
      this.data[trimmedNewName] = this.data[oldName];
      delete this.data[oldName];
    }

    this.saveCallback();
    return true;
  }

  toggleHabit(habitName: string, date: string): boolean {
    if (!this.data[habitName]) {
      this.data[habitName] = {};
    }

    const habitData = this.data[habitName] as { [date: string]: boolean };
    const currentValue = habitData[date] || false;
    habitData[date] = !currentValue;

    this.saveCallback();

    return habitData[date];
  }

  isHabitCompleted(habitName: string, date: string): boolean {
    const habitData = this.data[habitName];
    if (typeof habitData === 'object' && !Array.isArray(habitData)) {
      return habitData[date] || false;
    }
    return false;
  }

  getHabitStreak(habitName: string): number {
    const habitData = this.data[habitName];
    if (!habitData || typeof habitData !== 'object' || Array.isArray(habitData)) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = this.formatDate(checkDate);

      if ((habitData as { [date: string]: boolean })[dateStr]) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
