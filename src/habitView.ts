import { ItemView, WorkspaceLeaf, Modal, Setting } from 'obsidian';
import type HabitTrackerPlugin from './main';

export const VIEW_TYPE_HABIT_TRACKER = 'habit-tracker-view';

type ViewType = 'year' | 'month' | 'year-overview';

export class HabitTrackerView extends ItemView {
  plugin: HabitTrackerPlugin;
  private selectedHabit: string | null = null;
  private viewType: ViewType = 'year';
  private selectedMonth: Date = new Date();
  private selectedYear: number = new Date().getFullYear();

  constructor(leaf: WorkspaceLeaf, plugin: HabitTrackerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.selectedMonth.setDate(1);
  }

  getViewType(): string {
    return VIEW_TYPE_HABIT_TRACKER;
  }

  getDisplayText(): string {
    return 'Habit Tracker';
  }

  getIcon(): string {
    return 'calendar-check';
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    console.log('RENDER START: selectedHabit =', this.selectedHabit, 'Type:', typeof this.selectedHabit);
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('habit-tracker-container');

    this.renderControls(container);

    const habits = this.plugin.dataStore.getHabits();
    console.log('RENDER: Habits from store =', habits);

    if (habits.length === 0) {
      container.createEl('div', {
        text: 'No habits yet. Click "Add New Habit" to get started!',
        cls: 'no-habits-message'
      });
      console.log('RENDER: No habits, exiting.');
      return;
    }

    // If a habit is selected but no longer exists (e.g., deleted from another view),
    // or if no habit is selected at all, default to the first one.
    if (!this.selectedHabit || !habits.includes(this.selectedHabit)) {
      if (habits.length > 0) {
        this.selectedHabit = habits[0];
      } else {
        // No habits to select, ensure buttons are disabled and exit.
        this.selectedHabit = null;
        container.createEl('div', {
          text: 'No habits yet. Click "Add New Habit" to get started!',
          cls: 'no-habits-message'
        });
        return;
      }
    }

    if (this.selectedHabit) {
      if (this.viewType === 'year') {
        this.renderYearView(container, this.selectedHabit);
      } else if (this.viewType === 'month') {
        this.renderMonthView(container, this.selectedHabit);
      } else if (this.viewType === 'year-overview') {
        this.renderYearOverview(container, this.selectedHabit);
      }
    }
  }

  private renderControls(container: HTMLElement): void {
    const controlsSection = container.createEl('div', { cls: 'habit-controls' });

    const addButton = controlsSection.createEl('button', {
      text: 'Add',
      cls: 'habit-control-button'
    });
    addButton.addEventListener('click', () => {
      new AddHabitModal(this.app, this.plugin, async () => {
        await this.render();
      }).open();
    });

    const habits = this.plugin.dataStore.getHabits();

    if (habits.length > 0) {
      const selectorContainer = controlsSection.createEl('div', { cls: 'habit-selector-container' });


      const customDropdown = selectorContainer.createEl('div', { cls: 'custom-habit-dropdown' });

      const dropdownButton = customDropdown.createEl('button', { cls: 'habit-dropdown-button' });
      dropdownButton.createEl('span', { text: this.selectedHabit || 'Select Habit', cls: 'habit-dropdown-text' });
      dropdownButton.createEl('span', { text: '▼', cls: 'habit-dropdown-arrow' });

      const dropdownMenu = customDropdown.createEl('div', { cls: 'habit-dropdown-menu' });

      habits.forEach(habit => {
        const item = dropdownMenu.createEl('div', { cls: 'habit-dropdown-item' });

        if (habit === this.selectedHabit) {
          item.addClass('active');
        }

        const habitText = item.createEl('span', { text: habit, cls: 'habit-item-text' });
        habitText.addEventListener('click', async (e) => {
          e.stopPropagation();
          this.selectedHabit = habit;
          dropdownMenu.removeClass('show');
          await this.render();
        });
      });

      dropdownButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = dropdownMenu.hasClass('show');
        if (isShown) {
          dropdownMenu.removeClass('show');
        } else {
          dropdownMenu.addClass('show');
        }
      });

      this.registerDomEvent(document, 'click', (e: MouseEvent) => {
        if (!customDropdown.contains(e.target as Node)) {
          dropdownMenu.removeClass('show');
        }
      });

      console.log('Rendering Edit Button. selectedHabit:', this.selectedHabit, 'Type:', typeof this.selectedHabit);
      const editButton = controlsSection.createEl('button', {
        text: 'Edit',
        cls: 'habit-control-button'
      });
      editButton.disabled = !this.selectedHabit;
      editButton.addEventListener('click', () => {
        if (this.selectedHabit) {
          new EditHabitModal(this.app, this.plugin, this.selectedHabit, async (newName) => {
            this.selectedHabit = newName;
            await this.render();
          }).open();
        }
      });

      const deleteButton = controlsSection.createEl('button', {
        text: 'Delete',
        cls: 'habit-control-button'
      });
      deleteButton.disabled = !this.selectedHabit;
      deleteButton.addEventListener('click', () => {
        if (this.selectedHabit) {
          new DeleteHabitModal(this.app, this.plugin, this.selectedHabit, async () => {
            this.selectedHabit = null;
            await this.render();
          }).open();
        }
      });

      const viewControlsContainer = controlsSection.createEl('div', { cls: 'view-controls-container' });


      const radioGroup = viewControlsContainer.createEl('div', { cls: 'view-radio-group' });

      const viewOptions = [
        { value: 'year', text: 'Year', title: 'GitHub-style contribution grid' },
        { value: 'month', text: 'Month', title: 'Traditional monthly calendar' },
        { value: 'year-overview', text: 'Year Overview', title: 'All 12 months at a glance' }
      ];

      viewOptions.forEach(option => {
        const radioLabel = radioGroup.createEl('label', { cls: 'view-radio-label' });

        const radioInput = radioLabel.createEl('input', {
          type: 'radio',
          attr: {
            name: 'view-type',
            value: option.value
          },
          cls: 'view-radio-input'
        });

        if (option.value === this.viewType) {
          radioInput.checked = true;
        }

        radioInput.addEventListener('change', async () => {
          if (radioInput.checked) {
            this.viewType = option.value as ViewType;
            await this.render();
          }
        });

        radioLabel.createEl('span', { text: option.text, cls: 'view-radio-text' });
        radioLabel.setAttribute('title', option.title);
      });

      if (this.viewType === 'month') {
        const monthNav = viewControlsContainer.createEl('div', { cls: 'month-navigation' });

        const prevButton = monthNav.createEl('button', {
          text: '◀',
          cls: 'month-nav-button'
        });
        prevButton.addEventListener('click', async () => {
          this.selectedMonth.setMonth(this.selectedMonth.getMonth() - 1);
          await this.render();
        });

        const monthLabel = monthNav.createEl('span', {
          text: this.selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          cls: 'month-label-text'
        });

        const nextButton = monthNav.createEl('button', {
          text: '▶',
          cls: 'month-nav-button'
        });
        nextButton.addEventListener('click', async () => {
          this.selectedMonth.setMonth(this.selectedMonth.getMonth() + 1);
          await this.render();
        });

        const todayButton = monthNav.createEl('button', {
          text: 'Today',
          cls: 'month-nav-button today-button'
        });
        todayButton.addEventListener('click', async () => {
          this.selectedMonth = new Date();
          this.selectedMonth.setDate(1);
          await this.render();
        });
      }
    }
  }

  private renderYearView(container: HTMLElement, habitName: string): void {
    const section = container.createEl('div', { cls: 'habit-section github-style' });

    const header = section.createEl('div', { cls: 'github-header' });
    header.createEl('div', { text: habitName, cls: 'habit-name' });

    const yearContainer = section.createEl('div', { cls: 'github-year-container' });

    const graphContainer = yearContainer.createEl('div', { cls: 'github-graph-container' });

    const monthLabels = graphContainer.createEl('div', { cls: 'github-month-labels' });
    monthLabels.createEl('div', { cls: 'github-days-label-spacer' });

    const monthLabelContainer = monthLabels.createEl('div', { cls: 'github-month-label-container' });

    const gridWrapper = graphContainer.createEl('div', { cls: 'github-grid-wrapper' });

    const dayLabels = gridWrapper.createEl('div', { cls: 'github-day-labels' });
    ['Mon', 'Wed', 'Fri'].forEach((day, index) => {
      const label = dayLabels.createEl('div', { cls: 'github-day-label' });
      label.style.gridRow = `${index * 2 + 2}`;
      label.textContent = day;
    });

    const grid = gridWrapper.createEl('div', { cls: 'github-contribution-grid' });

    const startDate = new Date(this.selectedYear, 0, 1);
    const startDay = startDate.getDay();
    const daysToSubtract = startDay === 0 ? 6 : startDay - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    const endDate = new Date(this.selectedYear, 11, 31);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentMonthLabel = -1;
    let weekIndex = 0;

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalWeeks = Math.ceil(totalDays / 7);

    for (let week = 0; week < totalWeeks; week++) {
      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + (week * 7) + day);
        const dateStr = this.formatDate(currentDate);

        const cell = grid.createEl('div', { cls: 'github-cell' });
        cell.style.gridColumn = `${week + 1}`;
        cell.style.gridRow = `${day + 1}`;

        if (currentDate.getFullYear() !== this.selectedYear) {
          cell.addClass('outside-year');
        } else {
          const isCompleted = this.plugin.dataStore.isHabitCompleted(habitName, dateStr);
          if (isCompleted) {
            cell.addClass('completed');
          }

          if (this.isSameDay(currentDate, today)) {
            cell.addClass('today');
          }

          cell.setAttribute('data-date', dateStr);
          cell.setAttribute('title', `${habitName} - ${dateStr}`);

          cell.addEventListener('click', () => {
            const newState = this.plugin.dataStore.toggleHabit(habitName, dateStr);
            if (newState) {
              cell.addClass('completed');
            } else {
              cell.removeClass('completed');
            }
          });
        }

        if (day === 0 && currentDate.getFullYear() === this.selectedYear) {
          const month = currentDate.getMonth();
          if (month !== currentMonthLabel && week > 0) {
            const monthLabel = monthLabelContainer.createEl('div', { cls: 'github-month-label' });
            monthLabel.textContent = currentDate.toLocaleDateString('en-US', { month: 'short' });
            monthLabel.style.gridColumn = `${week + 1}`;
            currentMonthLabel = month;
          }
        }
      }
    }

    const yearSelector = yearContainer.createEl('div', { cls: 'github-year-selector' });
    const currentYear = new Date().getFullYear();
    const earliestYear = this.getEarliestYearWithData(habitName);
    const startYear = Math.min(earliestYear, currentYear);

    for (let year = startYear; year <= currentYear; year++) {
      const yearButton = yearSelector.createEl('button', {
        text: year.toString(),
        cls: 'github-year-button'
      });

      if (year === this.selectedYear) {
        yearButton.addClass('active');
      }

      if (year === currentYear) {
        yearButton.addClass('current-year');
      }

      yearButton.addEventListener('click', async () => {
        this.selectedYear = year;
        await this.render();
      });
    }
  }

  private renderMonthView(container: HTMLElement, habitName: string): void {
    const section = container.createEl('div', { cls: 'habit-section calendar-view' });

    section.createEl('div', { text: habitName, cls: 'habit-name' });

    const calendar = section.createEl('div', { cls: 'calendar-month' });

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekDayHeader = calendar.createEl('div', { cls: 'calendar-weekdays' });
    weekDays.forEach(day => {
      weekDayHeader.createEl('div', { text: day, cls: 'calendar-weekday' });
    });

    const daysGrid = calendar.createEl('div', { cls: 'calendar-days-grid' });

    const year = this.selectedMonth.getFullYear();
    const month = this.selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < startingDayOfWeek; i++) {
      daysGrid.createEl('div', { cls: 'calendar-day empty' });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = this.formatDate(currentDate);

      const dayCell = daysGrid.createEl('div', { cls: 'calendar-day' });
      dayCell.createEl('div', { text: day.toString(), cls: 'calendar-day-number' });

      const isCompleted = this.plugin.dataStore.isHabitCompleted(habitName, dateStr);
      if (isCompleted) {
        dayCell.addClass('completed');
      }

      if (this.isSameDay(currentDate, today)) {
        dayCell.addClass('today');
      }

      dayCell.setAttribute('data-date', dateStr);
      dayCell.setAttribute('title', `${habitName} - ${dateStr}`);

      dayCell.addEventListener('click', () => {
        const newState = this.plugin.dataStore.toggleHabit(habitName, dateStr);
        if (newState) {
          dayCell.addClass('completed');
        } else {
          dayCell.removeClass('completed');
        }
      });
    }
  }

  private renderYearOverview(container: HTMLElement, habitName: string): void {
    const section = container.createEl('div', { cls: 'habit-section year-overview' });

    const header = section.createEl('div', { cls: 'year-overview-header' });
    header.createEl('div', { text: habitName, cls: 'habit-name' });

    const yearContainer = section.createEl('div', { cls: 'year-overview-container' });

    const yearGrid = yearContainer.createEl('div', { cls: 'year-overview-grid' });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const isCurrentYear = this.selectedYear === currentYear;
    const lastMonth = isCurrentYear ? currentMonth : 11;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = today.getDate();

    for (let month = 0; month <= lastMonth; month++) {
      const monthContainer = yearGrid.createEl('div', { cls: 'year-overview-month' });

      monthContainer.createEl('div', { text: monthNames[month], cls: 'year-overview-month-name' });

      const monthDays = monthContainer.createEl('div', { cls: 'year-overview-days' });

      const daysInMonth = new Date(this.selectedYear, month + 1, 0).getDate();
      const isCurrentMonth = isCurrentYear && month === currentMonth;
      const lastDay = isCurrentMonth ? todayDate : daysInMonth;

      for (let day = 1; day <= lastDay; day++) {
        const currentDate = new Date(this.selectedYear, month, day);
        const dateStr = this.formatDate(currentDate);

        const dayCell = monthDays.createEl('div', { cls: 'year-overview-day' });
        dayCell.createEl('span', { text: day.toString(), cls: 'year-overview-day-number' });

        const isCompleted = this.plugin.dataStore.isHabitCompleted(habitName, dateStr);
        if (isCompleted) {
          dayCell.addClass('completed');
        }

        if (this.isSameDay(currentDate, today)) {
          dayCell.addClass('today');
        }

        dayCell.setAttribute('data-date', dateStr);
        dayCell.setAttribute('title', `${habitName} - ${dateStr}`);

        dayCell.addEventListener('click', () => {
          const newState = this.plugin.dataStore.toggleHabit(habitName, dateStr);
          if (newState) {
            dayCell.addClass('completed');
          } else {
            dayCell.removeClass('completed');
          }
        });
      }
    }

    const yearSelector = yearContainer.createEl('div', { cls: 'year-overview-year-selector' });
    const earliestYear = this.getEarliestYearWithData(habitName);
    const startYear = Math.min(earliestYear, currentYear);

    for (let year = startYear; year <= currentYear; year++) {
      const yearButton = yearSelector.createEl('button', {
        text: year.toString(),
        cls: 'year-overview-year-button'
      });

      if (year === this.selectedYear) {
        yearButton.addClass('active');
      }

      if (year === currentYear) {
        yearButton.addClass('current-year');
      }

      yearButton.addEventListener('click', async () => {
        this.selectedYear = year;
        await this.render();
      });
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  private getEarliestYearWithData(habitName: string): number {
    const currentYear = new Date().getFullYear();
    const habitData = this.plugin.dataStore.getData()[habitName];

    if (!habitData || typeof habitData !== 'object' || Array.isArray(habitData)) {
      return currentYear;
    }

    const dates = Object.keys(habitData as { [date: string]: boolean });
    if (dates.length === 0) {
      return currentYear;
    }

    let earliestYear = currentYear;
    dates.forEach(dateStr => {
      const year = parseInt(dateStr.split('-')[0]);
      if (year < earliestYear) {
        earliestYear = year;
      }
    });

    return earliestYear;
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }
}

class AddHabitModal extends Modal {
  plugin: HabitTrackerPlugin;
  onSubmit: () => Promise<void>;

  constructor(app: any, plugin: HabitTrackerPlugin, onSubmit: () => Promise<void>) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Add' });

    let habitName = '';

    new Setting(contentEl)
      .setName('Habit Name')
      .setDesc('Enter the name of your new habit')
      .addText(text => {
        text.setPlaceholder('e.g., Exercise, Read, Meditate')
          .onChange(value => {
            habitName = value;
          });
        text.inputEl.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.submit(habitName);
          }
        });
        setTimeout(() => text.inputEl.focus(), 10);
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Add')
        .setCta()
        .onClick(() => {
          this.submit(habitName);
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.close();
        }));
  }

  async submit(habitName: string): Promise<void> {
    if (!habitName.trim()) {
      return;
    }

    const success = this.plugin.dataStore.addHabit(habitName);
    if (success) {
      this.close();
      await this.onSubmit();
    } else {
      const errorEl = this.contentEl.createEl('div', {
        text: 'This habit already exists or the name is invalid!',
        cls: 'habit-error-message'
      });
      setTimeout(() => errorEl.remove(), 3000);
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class EditHabitModal extends Modal {
  plugin: HabitTrackerPlugin;
  oldName: string;
  onSubmit: (newName: string) => Promise<void>;

  constructor(app: any, plugin: HabitTrackerPlugin, oldName: string, onSubmit: (newName: string) => Promise<void>) {
    super(app);
    this.plugin = plugin;
    this.oldName = oldName;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Edit Habit' });

    let habitName = this.oldName;

    new Setting(contentEl)
      .setName('Habit Name')
      .setDesc('Enter the new name for your habit')
      .addText(text => {
        text.setValue(this.oldName)
          .setPlaceholder('e.g., Exercise, Read, Meditate')
          .onChange(value => {
            habitName = value;
          });
        text.inputEl.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.submit(habitName);
          }
        });
        setTimeout(() => {
          text.inputEl.focus();
          text.inputEl.select();
        }, 10);
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Save')
        .setCta()
        .onClick(() => {
          this.submit(habitName);
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.close();
        }));
  }

  async submit(habitName: string): Promise<void> {
    if (!habitName.trim() || habitName === this.oldName) {
      this.close();
      return;
    }

    const success = this.plugin.dataStore.renameHabit(this.oldName, habitName);
    if (success) {
      this.close();
      await this.onSubmit(habitName);
    } else {
      const errorEl = this.contentEl.createEl('div', {
        text: 'This habit name already exists or is invalid!',
        cls: 'habit-error-message'
      });
      setTimeout(() => errorEl.remove(), 3000);
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class DeleteHabitModal extends Modal {
  plugin: HabitTrackerPlugin;
  habitName: string;
  onSubmit: () => Promise<void>;

  constructor(app: any, plugin: HabitTrackerPlugin, habitName: string, onSubmit: () => Promise<void>) {
    super(app);
    this.plugin = plugin;
    this.habitName = habitName;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Delete Habit' });

    contentEl.createEl('p', {
      text: `Are you sure you want to delete "${this.habitName}"? This will remove all progress data for this habit.`
    });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Delete')
        .setWarning()
        .onClick(async () => {
          this.plugin.dataStore.removeHabit(this.habitName);
          this.close();
          await this.onSubmit();
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.close();
        }));
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
