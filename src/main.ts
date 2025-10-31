import { Plugin } from 'obsidian';
import { HabitTrackerView, VIEW_TYPE_HABIT_TRACKER } from './habitView';
import { HabitTrackerSettingTab } from './settings';
import { HabitParser } from './habitParser';
import { HabitDataStore } from './dataStore';
import { DEFAULT_SETTINGS, HabitTrackerSettings, HabitData } from './types';

export default class HabitTrackerPlugin extends Plugin {
  settings: HabitTrackerSettings;
  habitParser: HabitParser;
  dataStore: HabitDataStore;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.habitParser = new HabitParser(this.app);
    this.dataStore = new HabitDataStore(async () => {
      await this.saveHabitData();
    });

    // Load habit data
    const habitData = await this.loadData() as HabitData;
    this.dataStore.loadData(habitData || {});

    // Register view
    this.registerView(
      VIEW_TYPE_HABIT_TRACKER,
      (leaf) => new HabitTrackerView(leaf, this)
    );

    // Add ribbon icon
    this.addRibbonIcon('calendar-check', 'Open Habit Tracker', () => {
      this.activateView();
    });

    // Add command to open view
    this.addCommand({
      id: 'open-habit-tracker',
      name: 'Open Habit Tracker',
      callback: () => {
        this.activateView();
      }
    });

    // Add settings tab
    this.addSettingTab(new HabitTrackerSettingTab(this.app, this));
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_HABIT_TRACKER)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_HABIT_TRACKER,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async refreshView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_HABIT_TRACKER);
    for (const leaf of leaves) {
      const view = leaf.view as HabitTrackerView;
      const currentHabits = this.dataStore.getHabits();
      const selectedHabit = (view as any).selectedHabit; // Access private member for check

      // Only re-render if the selected habit is no longer valid
      // or if no habit is selected and there are habits available.
      // This prevents clobbering a valid state due to a background refresh.
      if (!selectedHabit || !currentHabits.includes(selectedHabit)) {
        await view.render();
      }
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await super.saveData(this.settings);
  }

  async saveHabitData(): Promise<void> {
    await super.saveData(this.dataStore.getData());
  }

  onunload(): void {
    // Cleanup
  }
}
