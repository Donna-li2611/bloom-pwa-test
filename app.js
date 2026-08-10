(() => {
  const STORAGE_KEY = 'bloom-prototype-v02-r2';
  const AI_ENDPOINT = 'https://bloom-ition-api-jtcsdtmpit.cn-beijing.fcapp.run';
  const AI_TOKEN_STORAGE_KEY = 'bloom-ai-test-token';
  const MEDIA_DB_NAME = 'bloom-media-v1';
  const MEDIA_STORE_NAME = 'media';
  const AI_MODELS = [
    { id: 'qwen3.7-plus', labelZh: '3.7 · 效果优先', labelEn: '3.7 · Best quality' },
    { id: 'qwen3.5-plus-2026-04-20', labelZh: '3.5 · 成本优先', labelEn: '3.5 · Lower cost' },
  ];
  const HABIT_TRANSLATIONS = [
    ['sleep', '睡眠', 'Sleep', ['早睡', '按时睡觉', 'go to bed early', 'bedtime']],
    ['wake_up', '起床', 'Wake up', ['早起', '按时起床', 'wake up early']],
    ['workout', '运动', 'Workout', ['健身', '锻炼', '训练', 'exercise', 'fitness']],
    ['reading', '阅读', 'Reading', ['看书', '读书', 'read']],
    ['weight', '体重记录', 'Weight tracking', ['记录体重', '称体重', 'track weight']],
    ['foot_bath', '泡脚', 'Foot soak', ['足浴', 'foot bath']],
    ['dream_journal', '梦境记录', 'Dream journal', ['记梦', '记录梦境', 'dream log']],
    ['running', '跑步', 'Running', ['晨跑', '夜跑', 'run']],
    ['walking', '散步', 'Walking', ['走路', '快走', 'walk']],
    ['cycling', '骑单车', 'Cycling', ['骑车', '自行车', 'bike']],
    ['swimming', '游泳', 'Swimming', ['swim']],
    ['yoga', '瑜伽', 'Yoga', []],
    ['stretching', '拉伸', 'Stretching', ['伸展', 'stretch']],
    ['strength_training', '力量训练', 'Strength training', ['撸铁', 'weight training']],
    ['badminton', '羽毛球', 'Badminton', []],
    ['table_tennis', '乒乓球', 'Table tennis', ['ping pong']],
    ['golf', '高尔夫', 'Golf', []],
    ['meditation', '冥想', 'Meditation', ['正念', 'meditate', 'mindfulness']],
    ['study', '学习', 'Study', ['专注学习', 'learn']],
    ['vocabulary', '背单词', 'Vocabulary', ['记单词', 'learn vocabulary']],
    ['english', '学英语', 'Learn English', ['英语学习', 'study english']],
    ['writing', '写作', 'Writing', ['write']],
    ['journaling', '写日记', 'Journaling', ['记日记', 'journal']],
    ['reflection', '每日复盘', 'Daily reflection', ['复盘', 'reflection']],
    ['drink_water', '喝水', 'Drink water', ['饮水', 'drink water']],
    ['healthy_eating', '健康饮食', 'Healthy eating', ['控制饮食', 'eat healthy']],
    ['take_medication', '服药', 'Take medication', ['吃药', 'take medicine']],
    ['vitamins', '吃维生素', 'Take vitamins', ['维生素', 'vitamins']],
    ['sleep_tracking', '记录睡眠', 'Track sleep', ['睡眠记录', 'sleep log']],
    ['tidy_up', '整理房间', 'Tidy up', ['收拾房间', 'clean room']],
    ['skincare', '护肤', 'Skincare', ['skin care']],
    ['brush_teeth', '刷牙', 'Brush teeth', ['brush my teeth']],
    ['daily_planning', '今日计划', 'Daily planning', ['每日计划', 'daily plan']],
    ['expense_tracking', '记账', 'Expense tracking', ['记录开支', 'track expenses']],
    ['mood_journal', '心情记录', 'Mood journal', ['记录心情', 'mood log']],
    ['gratitude', '感恩记录', 'Gratitude journal', ['感恩日记', 'gratitude journal']],
  ].map(([key, zh, en, aliases]) => ({ key, zh, en, aliases }));
  const normalizeHabitText = (value) => String(value || '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ');
  const resolveHabitTranslation = (name) => {
    const normalized = normalizeHabitText(name);
    const exactMatch = HABIT_TRANSLATIONS.find((item) => [item.zh, item.en, ...item.aliases]
      .some((candidate) => normalizeHabitText(candidate) === normalized));
    if (exactMatch) return exactMatch;
    const keywordMatches = HABIT_TRANSLATIONS.flatMap((item) => [item.zh, item.en, ...item.aliases]
      .map((candidate) => ({ item, keyword: normalizeHabitText(candidate) })))
      .filter(({ keyword }) => keyword.length > 1 && normalized.includes(keyword))
      .sort((left, right) => right.keyword.length - left.keyword.length);
    return keywordMatches[0]?.item;
  };
  const defaultHabitKeyById = {
    sleep: 'sleep', wake: 'wake_up', workout: 'workout', reading: 'reading',
    weight: 'weight', footbath: 'foot_bath', dream: 'dream_journal',
  };
  const weekdayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const bedtimeHistory = ['23:18', '23:42', '23:25', '23:08', '23:51', '23:22', '23:42'];
  const wakeHistory = ['06:54', '07:12', '06:48', '06:58', '07:18', '06:51', '06:52'];
  const weightHistory = [71.2, 71.0, 71.1, 70.9, 70.8, 70.9, 70.8];
  const SAMPLE_DATA_VERSION = 4;
  const mediaUrlCache = new Map();

  const openMediaDatabase = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB_NAME, 1);
    request.onerror = () => reject(request.error || new Error('media_db_open_failed'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        const store = database.createObjectStore(MEDIA_STORE_NAME, { keyPath: 'id' });
        store.createIndex('recordId', 'recordId', { unique: false });
        store.createIndex('recordType', 'recordType', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

  const saveMediaRecords = async (recordId, recordType, dataUrls, source = 'upload') => {
    const uploadedImages = dataUrls.filter((value) => String(value).startsWith('data:image/'));
    if (!uploadedImages.length) return [];
    const database = await openMediaDatabase();
    const imageIds = uploadedImages.map((dataUrl, index) => `${recordId}-image-${index + 1}`);
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(MEDIA_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(MEDIA_STORE_NAME);
      uploadedImages.forEach((dataUrl, index) => {
        const id = imageIds[index];
        mediaUrlCache.set(id, dataUrl);
        store.put({
          id,
          recordId,
          recordType,
          source,
          mimeType: String(dataUrl).slice(5, String(dataUrl).indexOf(';')) || 'image/jpeg',
          dataUrl,
          createdAt: new Date().toISOString(),
        });
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('media_db_write_failed'));
      transaction.onabort = () => reject(transaction.error || new Error('media_db_write_aborted'));
    });
    database.close();
    return imageIds;
  };

  const loadMediaRecords = async (imageIds = []) => {
    const missingIds = imageIds.filter((id) => id && !mediaUrlCache.has(id));
    if (!missingIds.length) return;
    const database = await openMediaDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(MEDIA_STORE_NAME, 'readonly');
      const store = transaction.objectStore(MEDIA_STORE_NAME);
      missingIds.forEach((id) => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result?.dataUrl) mediaUrlCache.set(id, request.result.dataUrl);
        };
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('media_db_read_failed'));
    });
    database.close();
  };

  const persistRecordImages = async (recordId, recordType, images, source = 'upload') => {
    const directImages = images.filter((value) => !String(value).startsWith('data:image/'));
    const uploadedImages = images.filter((value) => String(value).startsWith('data:image/'));
    try {
      const imageIds = await saveMediaRecords(recordId, recordType, uploadedImages, source);
      return { images: directImages, imageIds };
    } catch {
      // Older/private browser modes may block IndexedDB. Keep a localStorage fallback
      // so the user's image is never silently discarded.
      return { images: [...directImages, ...uploadedImages], imageIds: [] };
    }
  };

  const localDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dateFromKey = (value) => {
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day, 12);
  };

  const sampleHistoryRows = [
    ['2026-07-13', '23:25', '06:55', 71.4, 32, 18, 0, '', false],
    ['2026-07-14', '23:48', '07:08', 71.3, 20, 11, 42, '力量训练', true],
    ['2026-07-15', '23:12', '06:48', 71.2, 35, 24, 0, '', false],
    ['2026-07-16', '23:36', '06:58', 71.1, 30, 19, 35, '跑步', true],
    ['2026-07-17', '23:20', '07:05', 71.2, 42, 31, 0, '', false],
    ['2026-07-18', '00:05', '07:42', 71.0, 15, 9, 50, '瑜伽', true],
    ['2026-07-19', '23:28', '06:59', 71.0, 33, 22, 0, '', false],
    ['2026-07-20', '23:18', '06:52', 70.9, 36, 25, 38, '快走', true],
    ['2026-07-21', '23:44', '07:10', 70.9, 28, 16, 0, '', false],
    ['2026-07-22', '23:26', '06:49', 70.8, 40, 30, 45, '力量训练', true],
    ['2026-07-23', '23:15', '06:56', 70.9, 31, 20, 0, '', false],
    ['2026-07-24', '23:52', '07:16', 70.8, 18, 12, 32, '跑步', true],
    ['2026-07-25', '23:29', '07:02', 70.7, 34, 27, 0, '', false],
    ['2026-07-26', '23:21', '06:57', 70.8, 37, 28, 0, '', true],
    ['2026-07-27', '23:22', '06:50', 70.8, 36, 26, 0, '', true],
    ['2026-07-28', '23:41', '07:12', 70.7, 22, 14, 46, '力量训练', false],
    ['2026-07-29', '23:18', '06:55', 70.6, 41, 33, 0, '', true],
  ];

  const createSampleHistory = () => Object.fromEntries(sampleHistoryRows.map(([
    date, sleep, wake, weight, readingMinutes, readingPages, workoutMinutes, activityType, footbath,
  ]) => [
    date,
    {
      sleep: { status: sleep >= '05:00' && sleep <= '23:30' ? 'complete' : 'recorded', value: sleep },
      wake: { status: wake <= '07:00' ? 'complete' : 'recorded', value: wake },
      workout: {
        status: workoutMinutes ? 'complete' : 'none',
        minutes: workoutMinutes,
        activityType,
      },
      reading: {
        status: readingMinutes >= 30 ? 'complete' : 'recorded',
        minutes: readingMinutes,
        pages: readingPages,
      },
      weight: { status: 'complete', value: weight },
      footbath: { status: footbath ? 'complete' : 'none' },
    },
  ]));

  const copy = {
    zh: {
      prototype: '模拟数据原型',
      greeting: '早上好',
      morningGreeting: '早上好',
      afternoonGreeting: '下午好',
      eveningGreeting: '晚上好',
      today: '今天',
      review: '复盘',
      statistics: '统计',
      footprints: '足迹',
      records: '记录',
      allRecords: '全部',
      readingRecords: '阅读',
      workoutRecords: '运动',
      dreamRecords: '梦境',
      habits: '习惯',
      settings: '设置',
      modelSettings: '模型设置',
      aiModel: 'AI 模型',
      localOnly: '仅保存在本机',
      modelSettingsHint: '选择 Bloom 默认调用的模型。图片识别、阅读感悟、标题和梦境解读会优先使用它。',
      futureModels: '后续可添加更多模型，并按任务分别选择。',
      weeklyReview: '本周复盘',
      planAndActual: '计划与实际',
      bedtime: '入睡时间',
      sleepSchedule: '起床与入睡时间',
      actualBedtime: '实际入睡',
      actualWake: '实际起床',
      plannedBedtime: '计划 23:30',
      habitProgress: '习惯进度',
      weeklyOverview: '本周打卡',
      checkinCalendar: '打卡记录',
      recordAndPlan: '● 已记录 · ✓ 按计划',
      week: '周', month: '月', quarter: '季', year: '年',
      periodNames: { week: '本周', month: '本月', quarter: '本季度', year: '今年' },
      weightTrend: '体重趋势',
      futureHealthData: '未来可通过 IoT 加入体脂率、BMI 等身体数据',
      noData: '暂无记录',
      record: '记录',
      saveRecord: '保存记录',
      manageHabits: '管理习惯',
      myHabits: '我的习惯',
      manageHabitsHint: '用简单的名称表达习惯，把频率和记录方式交给 Bloom。',
      newHabit: '新习惯',
      whatToKeep: '你想坚持什么？',
      habitName: '习惯名称',
      chooseIcon: '选择图标',
      quantify: '记录具体数据',
      quantifyHint: '例如时长、页数、时间或数值',
      whatToRecord: '想记录什么？',
      enterValue: '记录数值',
      duration: '时长',
      count: '次数',
      number: '数值',
      time: '时间',
      target: '计划',
      unit: '单位',
      frequency: '多久一次？',
      everyDay: '每天',
      selectedDays: '每周指定',
      timesPerWeek: '每周几次',
      everyNDays: '每隔几天',
      chooseDays: '选择星期',
      weeklyCount: '每周完成几次？',
      intervalDays: '每隔几天？',
      createHabit: '创建习惯',
      editHabit: '编辑习惯',
      saveChanges: '保存修改',
      optionalContent: '打卡时可以添加',
      addNotes: '打卡时可以添加备注',
      addNotesHint: '支持文字、图片和语音输入',
      textNote: '文字备注',
      photo: '图片',
      voice: '语音',
      futurePhotoAi: '未来可让 AI 识别图片并生成文字描述',
      aiImageRecognition: 'AI 图片识别',
      aiRecognitionHint: '选择模型后识别；结果不会自动保存。',
      aiAccessToken: 'Bloom 测试密码',
      aiAccessTokenHint: '只保存在这台设备，不会写入公开网页代码。',
      rememberOnDevice: '保存在这台设备',
      recognizeImage: '识别这张图片',
      recognizing: '正在识别…',
      selectPhotoFirst: '请先选择一张图片',
      tokenRequired: '请输入 Bloom 测试密码',
      recognitionFailed: '识别失败，请稍后重试',
      useAsNote: '写入备注',
      useDetectedValue: '使用识别数值',
      confidence: '可信度',
      detectedText: '图片文字',
      uncertainties: '需要确认',
      noExtraDetails: '没有额外信息',
      resultWritten: '识别结果已写入备注，请确认后保存',
      futureAiIcon: '未来可以用一句描述让 AI 生成专属图标',
      notePlaceholder: '写下一点感受或补充…',
      choosePhoto: '选择图片',
      voicePrototype: '点击模拟语音输入',
      voiceAdded: '已加入一段模拟语音文字',
      dragHint: '拖动调整顺序',
      recordedSummary: (recorded, total) => `${recorded} / ${total} 已记录`,
      weekSummary: (done, total) => `${done} / ${total} 天按计划`,
      reviewSummary: (rate) => `本周按照计划完成 ${rate}%。记录本身也会保留，即使当天没有达到目标。`,
      actualPlan: (actual, plan) => `实际 ${actual} · 计划 ${plan}`,
      planActual: (plan, actual) => `计划 ${plan} · 实际 ${actual}`,
      weekMinutes: (actual, target) => `本周 ${actual} / ${target} 分钟`,
      todayReading: (minutes, pages) => `今天 ${minutes} 分钟 · ${pages} 页`,
      weightDetail: (value, change) => `今天 ${value} kg · 最近7天 ${change} kg`,
      dailyFrequency: '每天',
      selectedFrequency: (days) => `每周 ${days}`,
      weeklyFrequency: (count) => `每周 ${count} 次`,
      intervalFrequency: (days) => `每隔 ${days} 天`,
      simpleCheckin: '点击即可完成',
      quantified: (label) => `记录${label}`,
      saved: '打卡成功',
      habitCreated: '新习惯已加入原型',
      habitUpdated: '习惯配置已更新',
      timeLabel: '实际时间',
      plannedTime: (time) => `计划时间：${time}`,
      minutes: '分钟',
      pages: '页数',
      activity: '运动类型',
      activityOptions: ['羽毛球', '乒乓球', '高尔夫', '骑单车', '瑜伽', '其他'],
      otherActivity: '其他运动',
      otherActivityPlaceholder: '请输入运动类型',
      weight: '体重（kg）',
      completedToday: '打卡成功',
      tapToComplete: '点击完成今天的打卡',
      mon: '一', tue: '二', wed: '三', thu: '四', fri: '五', sat: '六', sun: '日',
      dayNames: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      metricLabels: { duration: '时长', count: '次数', number: '数值', time: '时间' },
      trackingLabels: {
        sleep: '记录时间', wake: '记录时间', workout: '记录时长', reading: '记录时长和页数', weight: '记录数值', footbath: '点击完成', dream: '记录梦境和 AI 解读',
      },
      habitNames: {
        sleep: '睡眠', wake: '起床', workout: '运动', reading: '阅读', weight: '体重记录', footbath: '泡脚', dream: '梦境记录',
      },
    },
    en: {
      prototype: 'Sample data prototype',
      greeting: 'Good morning',
      morningGreeting: 'Good morning',
      afternoonGreeting: 'Good afternoon',
      eveningGreeting: 'Good evening',
      today: 'Today',
      review: 'Review',
      statistics: 'Stats',
      footprints: 'Footprints',
      records: 'Journal',
      allRecords: 'All',
      readingRecords: 'Reading',
      workoutRecords: 'Workout',
      dreamRecords: 'Dreams',
      habits: 'Habits',
      settings: 'Settings',
      modelSettings: 'Model settings',
      aiModel: 'AI model',
      localOnly: 'Stored on this device',
      modelSettingsHint: 'Choose the default model for image analysis, reading reflections, titles, and dream interpretation.',
      futureModels: 'More models and task-specific choices can be added later.',
      weeklyReview: 'Weekly review',
      planAndActual: 'Plan and actual',
      bedtime: 'Bedtime',
      sleepSchedule: 'Wake and bedtime',
      actualBedtime: 'Actual bedtime',
      actualWake: 'Actual wake time',
      plannedBedtime: 'Plan 23:30',
      habitProgress: 'Habit progress',
      weeklyOverview: 'This week',
      checkinCalendar: 'Check-in history',
      recordAndPlan: '● recorded · ✓ on plan',
      week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year',
      periodNames: { week: 'This week', month: 'This month', quarter: 'This quarter', year: 'This year' },
      weightTrend: 'Weight trend',
      futureHealthData: 'IoT may add body fat, BMI, and other body data later',
      noData: 'No records yet',
      record: 'Record',
      saveRecord: 'Save record',
      manageHabits: 'Manage habits',
      myHabits: 'My habits',
      manageHabitsHint: 'Name the habit simply. Let Bloom handle tracking and frequency.',
      newHabit: 'New habit',
      whatToKeep: 'What would you like to keep doing?',
      habitName: 'Habit name',
      chooseIcon: 'Choose an icon',
      quantify: 'Track a value',
      quantifyHint: 'Such as duration, pages, time, or a number',
      whatToRecord: 'What do you want to track?',
      enterValue: 'Enter value',
      duration: 'Duration',
      count: 'Count',
      number: 'Number',
      time: 'Time',
      target: 'Plan',
      unit: 'Unit',
      frequency: 'How often?',
      everyDay: 'Every day',
      selectedDays: 'Selected days',
      timesPerWeek: 'Times per week',
      everyNDays: 'Every N days',
      chooseDays: 'Choose weekdays',
      weeklyCount: 'How many times each week?',
      intervalDays: 'How many days apart?',
      createHabit: 'Create habit',
      editHabit: 'Edit habit',
      saveChanges: 'Save changes',
      optionalContent: 'Optional check-in content',
      addNotes: 'Add notes at check-in',
      addNotesHint: 'Text, photo, and voice in one place',
      textNote: 'Text note',
      photo: 'Photo',
      voice: 'Voice',
      futurePhotoAi: 'AI may turn a photo into a text description later',
      aiImageRecognition: 'AI image recognition',
      aiRecognitionHint: 'Choose a model to analyze. Results are not saved automatically.',
      aiAccessToken: 'Bloom test password',
      aiAccessTokenHint: 'Stored only on this device, never in the public website code.',
      rememberOnDevice: 'Save on this device',
      recognizeImage: 'Analyze this photo',
      recognizing: 'Analyzing…',
      selectPhotoFirst: 'Choose a photo first',
      tokenRequired: 'Enter the Bloom test password',
      recognitionFailed: 'Recognition failed. Please try again.',
      useAsNote: 'Add to note',
      useDetectedValue: 'Use detected value',
      confidence: 'Confidence',
      detectedText: 'Detected text',
      uncertainties: 'Needs confirmation',
      noExtraDetails: 'No additional details',
      resultWritten: 'Result added to the note. Review it before saving.',
      futureAiIcon: 'Describe an idea to generate a personal AI icon later',
      notePlaceholder: 'Add a feeling or detail…',
      choosePhoto: 'Choose photo',
      voicePrototype: 'Simulate voice input',
      voiceAdded: 'A simulated voice transcript was added',
      dragHint: 'Drag to reorder',
      recordedSummary: (recorded, total) => `${recorded} / ${total} recorded`,
      weekSummary: (done, total) => `${done} / ${total} days on plan`,
      reviewSummary: (rate) => `You followed ${rate}% of this week’s plan. Records remain visible even when a target was not reached.`,
      actualPlan: (actual, plan) => `Actual ${actual} · plan ${plan}`,
      planActual: (plan, actual) => `Plan ${plan} · actual ${actual}`,
      weekMinutes: (actual, target) => `${actual} / ${target} min this week`,
      todayReading: (minutes, pages) => `${minutes} min · ${pages} pages today`,
      weightDetail: (value, change) => `${value} kg today · ${change} kg over 7 days`,
      dailyFrequency: 'Every day',
      selectedFrequency: (days) => `Weekly · ${days}`,
      weeklyFrequency: (count) => `${count} times weekly`,
      intervalFrequency: (days) => `Every ${days} days`,
      simpleCheckin: 'Tap to complete',
      quantified: (label) => `Track ${label}`,
      saved: 'Record saved',
      habitCreated: 'New habit added to the prototype',
      habitUpdated: 'Habit settings updated',
      timeLabel: 'Actual time',
      plannedTime: (time) => `Planned time: ${time}`,
      minutes: 'Minutes',
      pages: 'Pages',
      activity: 'Activity',
      activityOptions: ['Badminton', 'Table tennis', 'Golf', 'Cycling', 'Yoga', 'Other'],
      otherActivity: 'Other activity',
      otherActivityPlaceholder: 'Enter an activity',
      weight: 'Weight (kg)',
      completedToday: 'Completed today',
      tapToComplete: 'Tap to complete today',
      mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S',
      dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      metricLabels: { duration: 'duration', count: 'count', number: 'number', time: 'time' },
      trackingLabels: {
        sleep: 'Track time', wake: 'Track time', workout: 'Track duration', reading: 'Track time and pages', weight: 'Track value', footbath: 'Tap to complete', dream: 'Record dream and AI interpretation',
      },
      habitNames: {
        sleep: 'Sleep', wake: 'Wake up', workout: 'Workout', reading: 'Reading', weight: 'Weight log', footbath: 'Foot bath', dream: 'Dream journal',
      },
    },
  };

  const initialHabits = [
    {
      id: 'sleep', icon: 'sleep', kind: 'time', target: '23:30', actual: '23:42', recorded: true, complete: false,
      weekDone: 4, weekTarget: 7, frequency: { type: 'daily' }, recordOptions: { text: false, photo: false, voice: false },
      weekStates: ['complete', 'recorded', 'complete', 'complete', 'recorded', 'complete', 'recorded'],
    },
    {
      id: 'wake', icon: 'wake', kind: 'time', target: '07:00', actual: '06:52', recorded: true, complete: true,
      weekDone: 5, weekTarget: 7, frequency: { type: 'daily' }, recordOptions: { text: false, photo: false, voice: false },
      weekStates: ['complete', 'complete', 'complete', 'recorded', 'complete', 'complete', 'none'],
    },
    {
      id: 'workout', icon: 'workout', kind: 'workout', target: 3, actual: 2, minutes: 95, minuteTarget: 150,
      recorded: false, complete: false, weekDone: 2, weekTarget: 3, frequency: { type: 'weekly', count: 3 }, recordOptions: { text: true, photo: true, voice: false },
      weekStates: ['none', 'complete', 'none', 'none', 'complete', 'none', 'none'],
    },
    {
      id: 'reading', icon: 'reading', kind: 'reading', target: 30, minutes: 18, pages: 12,
      recorded: true, complete: false, weekDone: 4, weekTarget: 7, frequency: { type: 'daily' }, recordOptions: { text: true, photo: true, voice: true },
      weekStates: ['complete', 'complete', 'recorded', 'complete', 'complete', 'none', 'recorded'],
    },
    {
      id: 'weight', icon: 'weight', kind: 'weight', value: 70.8, change: -0.3,
      recorded: true, complete: true, weekDone: 7, weekTarget: 7, frequency: { type: 'daily' }, recordOptions: { text: false, photo: false, voice: false },
      weekStates: ['complete', 'complete', 'complete', 'complete', 'complete', 'complete', 'complete'],
    },
    {
      id: 'footbath', icon: 'footbath', kind: 'boolean', recorded: false, complete: false,
      weekDone: 3, weekTarget: 4, frequency: { type: 'weekly', count: 4 }, recordOptions: { text: true, photo: false, voice: false },
      weekStates: ['complete', 'none', 'complete', 'none', 'complete', 'none', 'none'],
    },
    {
      id: 'dream', icon: 'dream', kind: 'dream', recorded: false, complete: false,
      weekDone: 0, weekTarget: 7, frequency: { type: 'daily' }, recordOptions: { text: true, photo: false, voice: false },
      weekStates: ['none', 'none', 'none', 'none', 'none', 'none', 'none'],
    },
  ];

  const createInitialRecords = () => {
    return [
      {
        id: 'sample-reading-1',
        type: 'reading',
        habitId: 'reading',
        title: '推理小说里，秩序重新出现',
        summary: '读到侦探把凌乱线索重新排成因果链，我忽然意识到，复盘也是一种温柔的整理。',
        sourceText: '真正的答案并不总在最响亮的证词里，而在那些被忽略的小地方。',
        images: ['./assets/icons/reading.png?v=2', './assets/icons/study.png?v=2'],
        metrics: { minutes: 42, pages: 36 },
        createdAt: '2026-07-28T20:40:00+08:00',
      },
      {
        id: 'sample-reading-2',
        type: 'reading',
        habitId: 'reading',
        title: '关于自由，也关于承担',
        summary: '选择并不会消除代价，但能让代价变得值得。',
        sourceText: '自由不是没有约束，而是知道自己愿意为什么负责。',
        images: ['./assets/icons/reading.png?v=2'],
        metrics: { minutes: 28, pages: 21 },
        createdAt: '2026-07-22T21:10:00+08:00',
      },
      {
        id: 'sample-workout-1',
        type: 'workout',
        habitId: 'workout',
        title: '傍晚跑完，身体先替我放松了',
        content: '没有追配速，只保持舒服的呼吸。后半程节奏更稳定，回家路上觉得头脑也一起变轻了。',
        images: ['./assets/icons/workout.png?v=2', './assets/icons/walk.png?v=2'],
        metrics: { minutes: 31, activityType: '跑步' },
        createdAt: '2026-07-24T19:20:00+08:00',
      },
      {
        id: 'sample-workout-2',
        type: 'workout',
        habitId: 'workout',
        title: '力量训练后的踏实感',
        content: '深蹲、划船、肩推。把动作做慢以后，反而更能感受到身体参与。今天没有加重量，但完成度更高。',
        images: ['./assets/icons/workout.png?v=2'],
        metrics: { minutes: 46, activityType: '力量训练' },
        createdAt: '2026-07-16T18:35:00+08:00',
      },
    ];
  };

  const cloneInitialState = () => ({
    language: 'zh',
    defaultAiModel: AI_MODELS[0].id,
    sampleDataVersion: 0,
    history: createSampleHistory(),
    records: createInitialRecords(),
    habits: initialHabits.map((habit) => {
      const habitKey = defaultHabitKeyById[habit.id] || habit.id;
      const translation = HABIT_TRANSLATIONS.find((item) => item.key === habitKey);
      return {
        ...habit,
        habitKey,
        nameZh: translation?.zh || '',
        nameEn: translation?.en || '',
        weekStates: [...habit.weekStates],
        frequency: { ...habit.frequency },
        recordOptions: { ...habit.recordOptions },
      };
    }),
  });

  const weekDateKeysFor = (referenceDate) => {
    const monday = new Date(referenceDate);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + index);
      return localDateKey(date);
    });
  };

  const currentWeekDateKeys = () => weekDateKeysFor(new Date());

  const applyRequestedSampleData = (loadedState) => {
    if (loadedState.sampleDataVersion >= SAMPLE_DATA_VERSION) return loadedState;
    loadedState.sampleDataVersion = SAMPLE_DATA_VERSION;
    loadedState.history = createSampleHistory();
    const weekKeys = currentWeekDateKeys();
    const todayIndex = (new Date().getDay() + 6) % 7;
    loadedState.habits = loadedState.habits.map((habit) => {
      const weekStates = weekKeys.map((date) => loadedState.history[date]?.[habit.id]?.status || 'none');
      habit.weekStates = weekStates;
      habit.weekDone = weekStates.filter((status) => status === 'complete').length;
      habit.recorded = false;
      habit.complete = false;
      habit.weekStates[todayIndex] = 'none';
      if (habit.kind === 'time') habit.actual = '';
      if (habit.kind === 'workout') {
        const entries = weekKeys
          .slice(0, todayIndex)
          .map((date) => loadedState.history[date]?.workout)
          .filter(Boolean);
        habit.minutes = entries.reduce((total, entry) => total + (entry.minutes || 0), 0);
        habit.actual = entries.filter((entry) => entry.status !== 'none').length;
      }
      if (habit.kind === 'reading') {
        habit.minutes = 0;
        habit.pages = 0;
      }
      if (habit.kind === 'weight') habit.value = 70.6;
      return habit;
    });
    const personalRecords = (loadedState.records || []).filter((record) => {
      if (String(record.id).startsWith('sample-')) return false;
      return localDateKey(new Date(record.createdAt)) !== '2026-07-30';
    });
    loadedState.records = [...createInitialRecords(), ...personalRecords];
    return loadedState;
  };

  const normalizeRecordSchema = (record) => {
    const normalized = {
      ...record,
      images: Array.isArray(record.images) ? record.images : [],
      imageIds: Array.isArray(record.imageIds) ? record.imageIds : [],
    };
    if (record.type === 'workout') {
      normalized.content = record.content || [record.sourceText, record.summary]
        .filter(Boolean)
        .join('\n');
      delete normalized.summary;
      delete normalized.sourceText;
    }
    return normalized;
  };

  const loadState = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed?.habits?.length) {
        parsed.habits = parsed.habits.map((habit) => {
          const habitKey = habit.habitKey || defaultHabitKeyById[habit.id] || habit.id;
          const translation = resolveHabitTranslation(habit.sourceName || habit.name)
            || HABIT_TRANSLATIONS.find((item) => item.key === habitKey);
          return {
            ...habit,
            habitKey: translation?.key || habitKey,
            sourceName: habit.sourceName || habit.name || '',
            nameZh: habit.nameZh || translation?.zh || '',
            nameEn: habit.nameEn || translation?.en || '',
            recordOptions: habit.recordOptions || { text: false, photo: false, voice: false },
          };
        });
        if (!parsed.habits.some((habit) => habit.id === 'dream')) {
          const dreamHabit = initialHabits.find((habit) => habit.id === 'dream');
          const dreamTranslation = HABIT_TRANSLATIONS.find((item) => item.key === 'dream_journal');
          parsed.habits.push({
            ...dreamHabit,
            habitKey: 'dream_journal',
            nameZh: dreamTranslation?.zh || '梦境记录',
            nameEn: dreamTranslation?.en || 'Dream journal',
            weekStates: [...dreamHabit.weekStates],
            frequency: { ...dreamHabit.frequency },
            recordOptions: { ...dreamHabit.recordOptions },
          });
        }
        if (!AI_MODELS.some((model) => model.id === parsed.defaultAiModel)) {
          parsed.defaultAiModel = AI_MODELS[0].id;
        }
        if (!Array.isArray(parsed.records)) parsed.records = createInitialRecords();
        parsed.records = parsed.records.map(normalizeRecordSchema);
        const migrated = applyRequestedSampleData(parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch {}
    const initialState = applyRequestedSampleData(cloneInitialState());
    initialState.records = initialState.records.map(normalizeRecordSchema);
    return initialState;
  };

  let state = loadState();
  let selectedTodayDate = new Date();
  let activeHabitId = null;
  let selectedCheckinImageDataUrl = '';
  let aiRecognitionResults = new Map();
  let readingSession = null;
  let pendingWorkoutSession = null;
  let dreamSession = null;
  let recordFilter = 'all';
  let selectedIcon = 'sprout';
  let selectedFrequency = 'daily';
  let reviewPeriod = 'week';
  let reviewOffset = 0;
  let draggedHabitId = null;
  let pendingDeleteHabitId = null;

  const hydrateAndMigrateRecordMedia = async () => {
    let changed = false;
    for (const record of state.records) {
      record.imageIds = Array.isArray(record.imageIds) ? record.imageIds : [];
      record.images = Array.isArray(record.images) ? record.images : [];
      const legacyUploads = record.images.filter((image) => String(image).startsWith('data:image/'));
      if (legacyUploads.length) {
        const storedMedia = await persistRecordImages(record.id, record.type, record.images);
        if (storedMedia.imageIds.length) {
          record.images = storedMedia.images;
          record.imageIds = [...new Set([...record.imageIds, ...storedMedia.imageIds])];
          changed = true;
        }
      }
      await loadMediaRecords(record.imageIds).catch(() => {});
    }
    const latestReading = state.habits.find((habit) => habit.id === 'reading')?.latestReadingRecord;
    if (latestReading) {
      const matchingRecord = state.records.find((record) => record.id === latestReading.id);
      if (matchingRecord) {
        latestReading.images = [...matchingRecord.images];
        latestReading.imageIds = [...matchingRecord.imageIds];
      }
    }
    if (changed) persist();
    renderAll();
  };
  let toastTimer = null;

  const elements = {
    habitList: document.getElementById('habit-list'),
    managedHabitList: document.getElementById('managed-habit-list'),
    modelSettingsList: document.getElementById('model-settings-list'),
    recordSections: document.getElementById('record-sections'),
    weekMatrix: document.getElementById('week-matrix'),
    sleepChart: document.getElementById('sleep-chart'),
    weightChart: document.getElementById('weight-chart'),
    sheet: document.getElementById('checkin-sheet'),
    habitSheet: document.getElementById('habit-sheet'),
    scrim: document.getElementById('scrim'),
    fields: document.getElementById('checkin-fields'),
    result: document.getElementById('checkin-result'),
    toast: document.getElementById('toast'),
  };

  const t = () => copy[state.language];
  const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const selectedDateKey = () => localDateKey(selectedTodayDate);
  const todayWeekIndex = () => (selectedTodayDate.getDay() + 6) % 7;
  const selectedRecordTimestamp = () => {
    const timestamp = new Date(selectedTodayDate);
    const now = new Date();
    timestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return timestamp.toISOString();
  };
  const recordTodayInHistory = (habit, details = {}) => {
    const date = selectedDateKey();
    state.history ||= {};
    state.history[date] ||= {};
    const status = habit.complete ? 'complete' : habit.recorded ? 'recorded' : 'none';
    const entry = { status };
    if (habit.kind === 'time') {
      entry.value = habit.actual;
    }
    if (habit.kind === 'workout') {
      entry.minutes = details.minutes || 0;
      entry.activityType = details.activityType || '';
    }
    if (habit.kind === 'reading') {
      entry.minutes = habit.minutes;
      entry.pages = habit.pages;
    }
    if (habit.kind === 'weight') entry.value = habit.value;
    if (habit.kind === 'custom' && habit.quantified) entry.value = habit.value;
    if (habit.kind === 'dream') {
      entry.dreamText = details.dreamText || '';
      entry.interpretation = details.interpretation || '';
      entry.recordId = details.recordId || '';
    }
    state.history[date][habit.id] = entry;
  };
  const ratio = (habit) => {
    const progress = currentWeekProgress(habit);
    return Math.min(1, progress.complete / Math.max(1, progress.target));
  };
  const habitName = (habit) => {
    const localizedName = state.language === 'zh' ? habit.nameZh : habit.nameEn;
    return localizedName || habit.sourceName || habit.name || t().habitNames[habit.id] || '';
  };
  const legacyIcons = {
    '🌙': 'sleep', '🌅': 'wake', '☀️': 'wake', '🏃': 'workout', '📖': 'reading',
    '⚖️': 'weight', '🛁': 'footbath', '🧘': 'meditation', '💧': 'water', '🌱': 'sprout',
  };
  const iconKey = (value) => legacyIcons[value] || value || 'sprout';
  const fallbackColors = ['#f2a928', '#ef7661', '#d979a7', '#9f87d8', '#6f9ed8', '#68b9c7', '#78a766', '#b6a35c', '#a97856', '#73776f'];
  const iconShapes = {
    sleep: '<rect x="12" y="37" width="40" height="14" rx="7" fill="#9ec8e8"/><path d="M38 11c-12 3-16 20-5 27 7 5 17 1 20-7-12 4-22-8-15-20Z" fill="#ffc14d"/><path d="M38 11c-12 3-16 20-5 27 7 5 17 1 20-7-12 4-22-8-15-20Z" fill="none" stroke="#63391f" stroke-width="3.5" stroke-linejoin="round"/><path d="M17 44h30" stroke="#63391f" stroke-width="3" stroke-linecap="round"/>',
    wake: '<path d="M10 47h44" stroke="#63391f" stroke-width="3.5" stroke-linecap="round"/><path d="M18 46a14 14 0 0 1 28 0" fill="#ffc14d" stroke="#63391f" stroke-width="3.5"/><path d="M32 12v7M13 31H7m50 0h-6M18 18l5 5m23-5-5 5" stroke="#ee8d2b" stroke-width="4" stroke-linecap="round"/>',
    workout: '<path d="M10 39c8-1 13-8 16-18l8 11 17 7c4 2 5 8 1 11H20c-7 0-11-4-10-11Z" fill="#76b9df" stroke="#63391f" stroke-width="3.5" stroke-linejoin="round"/><path d="M31 31l7-7m-2 11 7-6M14 44h38" stroke="#fff8e9" stroke-width="3" stroke-linecap="round"/>',
    reading: '<path d="M8 17c9-3 17-1 24 5v29c-7-6-15-8-24-5V17Zm48 0c-9-3-17-1-24 5v29c7-6 15-8 24-5V17Z" fill="#fff7dd" stroke="#63391f" stroke-width="3.5" stroke-linejoin="round"/><path d="M32 22v29" stroke="#63391f" stroke-width="3"/><path d="M43 13v17l5-4 5 4V12" fill="#86a768" stroke="#63391f" stroke-width="3" stroke-linejoin="round"/>',
    weight: '<rect x="10" y="12" width="44" height="42" rx="12" fill="#9ab37b" stroke="#63391f" stroke-width="3.5"/><path d="M21 20h22l-3 15H24l-3-15Z" fill="#fff7dd" stroke="#63391f" stroke-width="3"/><path d="M32 24v7" stroke="#ee8d2b" stroke-width="3" stroke-linecap="round"/><path d="M20 45h4m16 0h4" stroke="#63391f" stroke-width="3" stroke-linecap="round"/>',
    footbath: '<path d="M9 33h46l-5 19H14L9 33Z" fill="#83c7e1" stroke="#63391f" stroke-width="3.5" stroke-linejoin="round"/><path d="M21 14c-5 7 4 8-1 15m13-15c-5 7 4 8-1 15m13-15c-5 7 4 8-1 15" fill="none" stroke="#ee8d2b" stroke-width="3" stroke-linecap="round"/><path d="M18 38c5 4 23 4 28 0" fill="none" stroke="#fff8e9" stroke-width="3" stroke-linecap="round"/>',
    sprout: '<path d="M32 52V28" stroke="#63391f" stroke-width="4" stroke-linecap="round"/><path d="M31 31C18 31 13 23 14 14c11-1 19 5 17 17Zm2 1c13 0 19-8 18-18-11-1-20 6-18 18Z" fill="#8eaa69" stroke="#63391f" stroke-width="3.5" stroke-linejoin="round"/><path d="M20 53h24" stroke="#ee8d2b" stroke-width="4" stroke-linecap="round"/>',
    meditation: '<circle cx="32" cy="16" r="7" fill="#ffc14d" stroke="#63391f" stroke-width="3.5"/><path d="M32 24v14m0-8-12 8m12-8 12 8M17 49c6-7 11-9 15-5 4-4 9-2 15 5-9 5-21 5-30 0Z" fill="#b9a5d8" stroke="#63391f" stroke-width="3.5" stroke-linejoin="round"/>',
    water: '<path d="M16 12h32l-4 42H20l-4-42Z" fill="#dff4f8" stroke="#63391f" stroke-width="3.5" stroke-linejoin="round"/><path d="M20 31c8-4 16 4 25 0l-2 20H21l-1-20Z" fill="#66bfe1"/><path d="M21 20h22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
    study: '<rect x="11" y="10" width="34" height="44" rx="5" fill="#f4a43b" stroke="#63391f" stroke-width="3.5"/><path d="M19 20h18M19 28h14M19 36h16" stroke="#fff7dd" stroke-width="3" stroke-linecap="round"/><path d="m45 43 8-23 5 2-8 23-6 7 1-9Z" fill="#ffc14d" stroke="#63391f" stroke-width="3" stroke-linejoin="round"/>',
    walk: '<path d="M22 10c7 1 9 8 5 14s-13 3-14-4 3-11 9-10Zm20 26c8 1 11 9 6 15s-14 2-15-5 3-11 9-10Z" fill="#8db179" stroke="#63391f" stroke-width="3.5"/><circle cx="10" cy="12" r="3" fill="#ee8d2b"/><circle cx="51" cy="30" r="3" fill="#ee8d2b"/>',
    medicine: '<path d="M18 47c-7-7-7-18 0-25l6-6c7-7 18-7 25 0s7 18 0 25l-6 6c-7 7-18 7-25 0Z" fill="#f29a91" stroke="#63391f" stroke-width="3.5"/><path d="m19 46 29-29" stroke="#fff7dd" stroke-width="5"/>',
    nutrition: '<path d="M32 20c-9-8-21 0-19 14 3 19 14 22 19 16 5 6 16 3 19-16 2-14-10-22-19-14Z" fill="#ef7661" stroke="#63391f" stroke-width="3.5"/><path d="M32 20c0-7 5-11 11-11" stroke="#63391f" stroke-width="3.5" stroke-linecap="round"/><path d="M33 16c5-6 12-4 15 1-6 4-11 4-15-1Z" fill="#8eaa69" stroke="#63391f" stroke-width="3"/>',
  };
  const iconMarkup = (value) => {
    const key = iconKey(value);
    if (key.startsWith('letter-')) {
      const letter = key.slice(7, 8);
      const color = fallbackColors[letter.charCodeAt(0) % fallbackColors.length];
      return `<span class="fallback-icon-art" style="--fallback-color:${color}">${letter}</span>`;
    }
    if (key.startsWith('color-')) {
      const index = Number(key.slice(6)) || 0;
      return `<span class="fallback-icon-art color-only" style="--fallback-color:${fallbackColors[index % fallbackColors.length]}"></span>`;
    }
    if (key === 'dream') {
      return `<svg class="icon-art dream-icon-art" viewBox="0 0 64 64" role="img" aria-label="梦境"><path d="M12 42c0-8 6-14 14-14 3-9 16-10 21-2 8 0 12 5 12 11 0 8-7 13-15 13H24c-7 0-12-3-12-8Z" fill="#a9c9e8" stroke="#63391f" stroke-width="3.5" stroke-linejoin="round"/><path d="M31 9c-7 2-10 11-5 17 4 5 12 4 16 0-8 1-13-8-11-17Z" fill="#ffc14d" stroke="#63391f" stroke-width="3" stroke-linejoin="round"/><path d="m49 11 1.8 4.2L55 17l-4.2 1.8L49 23l-1.8-4.2L43 17l4.2-1.8L49 11Z" fill="#fff7dd" stroke="#63391f" stroke-width="2"/></svg>`;
    }
    return `<img class="icon-art" src="./assets/icons/${key}.png?v=2" alt="">`;
  };

  const formatFrequency = (frequency) => {
    if (frequency.type === 'weekly') return t().weeklyFrequency(frequency.count);
    if (frequency.type === 'weekdays') return t().selectedFrequency(frequency.days.map((day) => t()[day]).join('、'));
    if (frequency.type === 'interval') return t().intervalFrequency(frequency.days);
    return t().dailyFrequency;
  };

  const formatValueWithUnit = (value, unit) => unit ? `${value} ${unit}` : String(value);

  const habitDetail = (habit) => {
    const todayEntry = state.history?.[selectedDateKey()]?.[habit.id];
    if (habit.kind === 'time') return t().planActual(habit.target, todayEntry?.value || habit.actual || '—');
    if (habit.kind === 'workout') {
      const unit = state.language === 'zh' ? '分钟' : 'min';
      const actual = todayEntry?.status && todayEntry.status !== 'none'
        ? `${todayEntry.minutes || 0} ${unit}`
        : '—';
      return t().planActual(`${habit.minuteTarget} ${unit}`, actual);
    }
    if (habit.kind === 'reading') {
      const planned = state.language === 'zh' ? `${habit.target} 分钟` : `${habit.target} min`;
      const actual = todayEntry?.status && todayEntry.status !== 'none'
        ? state.language === 'zh'
          ? `${todayEntry.minutes || 0} 分钟 · ${todayEntry.pages || 0} 页`
          : `${todayEntry.minutes || 0} min · ${todayEntry.pages || 0} pages`
        : '—';
      return t().planActual(planned, actual);
    }
    if (habit.kind === 'weight') {
      const planned = state.language === 'zh' ? '每天记录' : 'daily log';
      return t().planActual(planned, Number.isFinite(todayEntry?.value) ? `${todayEntry.value} kg` : '—');
    }
    if (habit.kind === 'dream') {
      return t().planActual(
        state.language === 'zh' ? '每天记录' : 'daily log',
        todayEntry?.status && todayEntry.status !== 'none'
          ? state.language === 'zh' ? '打卡成功' : 'Check-in complete'
          : '—',
      );
    }
    if (habit.kind === 'custom' && habit.quantified) {
      const actual = todayEntry?.status && todayEntry.status !== 'none'
        ? formatValueWithUnit(todayEntry.value, habit.unit)
        : '—';
      return t().planActual(
        formatValueWithUnit(habit.target, habit.unit),
        actual,
      );
    }
    return t().planActual(
      formatFrequency(habit.frequency),
      todayEntry?.status && todayEntry.status !== 'none'
        ? state.language === 'zh' ? '打卡成功' : 'Check-in complete'
        : '—',
    );
  };

  const habitRatioLabel = (habit) => {
    if (habit.kind === 'reading') return `${habit.minutes} / ${habit.target}`;
    if (habit.kind === 'custom' && habit.quantified && habit.frequency.type === 'daily') return `${habit.value || 0} / ${habit.target}`;
    const progress = currentWeekProgress(habit);
    if (habit.kind === 'time') {
      return state.language === 'zh'
        ? `记录 ${progress.recorded} · 达标 ${progress.complete}/${progress.target}`
        : `${progress.recorded} logged · ${progress.complete}/${progress.target} on plan`;
    }
    return `${progress.complete} / ${progress.target}`;
  };

  const statusSymbol = (habit) => habit.complete ? '✓' : habit.recorded ? '•' : '+';
  const statusClass = (habit) => habit.complete ? 'is-complete' : habit.recorded ? 'is-recorded' : '';

  const renderToday = () => {
    const visibleHabits = state.habits.filter((habit) => !habit.hidden);
    const recorded = visibleHabits.filter((habit) => habit.recorded).length;
    document.getElementById('today-recorded-summary').textContent = t().recordedSummary(recorded, visibleHabits.length);
    elements.habitList.innerHTML = visibleHabits.map((habit) => `
      <article class="habit-card">
        <span class="habit-icon" aria-hidden="true">${iconMarkup(habit.icon)}</span>
        <div class="habit-identity">
          <span class="habit-name">${habitName(habit)}</span>
          <span class="habit-ratio">${habitRatioLabel(habit)}</span>
        </div>
        <div class="habit-copy">
          <div class="progress-track"><div class="progress-fill" style="width:${Math.round(habit.kind === 'reading' ? habit.minutes / habit.target * 100 : ratio(habit) * 100)}%"></div></div>
          <span class="habit-detail">${habitDetail(habit)}</span>
        </div>
        <button class="checkin-button ${statusClass(habit)}" type="button" data-checkin="${habit.id}" aria-label="${habitName(habit)}">${statusSymbol(habit)}</button>
      </article>
    `).join('');
  };

  const normalizedBedtimeMinutes = (value) => {
    const minutes = timeToMinutes(value);
    return minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
  };

  const historyStatus = (date, habitId) => {
    const entry = state.history?.[date]?.[habitId];
    if (!entry || entry.status === 'none') return 'none';
    if ((habitId === 'sleep' || habitId === 'wake') && entry.value) {
      const habit = state.habits.find((item) => item.id === habitId);
      if (!habit?.target) return entry.status;
      const actualMinutes = habitId === 'sleep'
        ? normalizedBedtimeMinutes(entry.value)
        : timeToMinutes(entry.value);
      const targetMinutes = habitId === 'sleep'
        ? normalizedBedtimeMinutes(habit.target)
        : timeToMinutes(habit.target);
      return actualMinutes <= targetMinutes ? 'complete' : 'recorded';
    }
    return entry.status;
  };

  const syncTodayHabitState = () => {
    const today = selectedDateKey();
    const entries = state.history?.[today] || {};
    const selectedWeekKeys = weekDateKeysFor(selectedTodayDate);
    state.habits.forEach((habit) => {
      const entry = entries[habit.id];
      const status = historyStatus(today, habit.id);
      habit.weekStates = selectedWeekKeys.map((date) => historyStatus(date, habit.id));
      habit.weekDone = habit.weekStates.filter((weekStatus) => weekStatus === 'complete').length;
      habit.recorded = status !== 'none';
      habit.complete = status === 'complete';
      if (habit.kind === 'time') habit.actual = entry?.value || '';
      if (habit.kind === 'reading') {
        habit.minutes = entry?.minutes || 0;
        habit.pages = entry?.pages || 0;
      }
      if (habit.kind === 'custom' && habit.quantified) {
        habit.value = entry?.value ?? '';
      }
      if (habit.kind === 'weight') habit.value = entry?.value ?? '';
    });
  };

  const currentWeekProgress = (habit) => {
    const statuses = weekDateKeysFor(selectedTodayDate).map((date) => historyStatus(date, habit.id));
    return {
      recorded: statuses.filter((status) => status !== 'none').length,
      complete: statuses.filter((status) => status === 'complete').length,
      target: habit.weekTarget,
    };
  };

  const renderReview = () => {
    const sleep = state.habits.find((habit) => habit.id === 'sleep');
    const wake = state.habits.find((habit) => habit.id === 'wake');
    const buckets = periodBuckets();
    const selectedDates = buckets.flatMap((bucket) => bucket.dateKeys);
    const sleepRecorded = selectedDates.filter((date) => historyStatus(date, 'sleep') !== 'none').length;
    const wakeRecorded = selectedDates.filter((date) => historyStatus(date, 'wake') !== 'none').length;
    const sleepDone = selectedDates.filter((date) => historyStatus(date, 'sleep') === 'complete').length;
    const wakeDone = selectedDates.filter((date) => historyStatus(date, 'wake') === 'complete').length;
    document.getElementById('sleep-week-summary').textContent = sleep || wake
      ? state.language === 'zh'
        ? `入睡达标 ${sleepDone}/${sleepRecorded} · 起床达标 ${wakeDone}/${wakeRecorded}`
        : `Bed target ${sleepDone}/${sleepRecorded} · wake target ${wakeDone}/${wakeRecorded}`
      : t().noData;
    const weight = state.habits.find((habit) => habit.id === 'weight');
    const selectedWeights = selectedDates
      .map((date) => state.history?.[date]?.weight?.value)
      .filter((value) => Number.isFinite(value));
    const selectedWeight = selectedWeights[selectedWeights.length - 1];
    const selectedWeightChange = selectedWeights.length > 1
      ? (selectedWeights[selectedWeights.length - 1] - selectedWeights[0]).toFixed(1)
      : '0.0';
    document.getElementById('weight-summary').textContent = weight && Number.isFinite(selectedWeight)
      ? state.language === 'zh' ? `${selectedWeight} kg · 本期 ${selectedWeightChange} kg` : `${selectedWeight} kg · period ${selectedWeightChange} kg`
      : t().noData;
    renderPeriodHeader();
    const columns = buckets.map((bucket) => bucket.label);
    const matrixScroll = elements.weekMatrix.closest('.matrix-scroll');
    matrixScroll?.classList.toggle('is-year-period', reviewPeriod === 'year');
    elements.weekMatrix.dataset.period = reviewPeriod;
    elements.weekMatrix.innerHTML = `
      <thead><tr><th>${t().habits}</th>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead>
      <tbody>${state.habits.map((habit) => `
        <tr>
          <td><span class="matrix-habit-icon">${iconMarkup(habit.icon)}</span>${habitName(habit)}</td>
          ${buckets.map((bucket) => {
            const status = aggregateHabitStatus(bucket, habit.id);
            return `<td><span class="matrix-mark ${status === 'complete' ? 'is-complete' : status === 'recorded' ? 'is-recorded' : ''}">${status === 'complete' ? '✓' : status === 'recorded' ? '•' : '○'}</span></td>`;
          }).join('')}
        </tr>
      `).join('')}</tbody>
    `;
    renderWeightChart();
    renderSleepChart();
  };

  const startOfWeek = (date) => {
    const result = new Date(date);
    const day = result.getDay() || 7;
    result.setDate(result.getDate() - day + 1);
    result.setHours(12, 0, 0, 0);
    return result;
  };

  const formatShortDate = (date) => new Intl.DateTimeFormat(state.language === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit', day: '2-digit',
  }).format(date);

  const periodBounds = () => {
    const now = new Date();
    let start;
    let end;
    if (reviewPeriod === 'week') {
      start = startOfWeek(now);
      start.setDate(start.getDate() + reviewOffset * 7);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
    } else if (reviewPeriod === 'month') {
      start = new Date(now.getFullYear(), now.getMonth() + reviewOffset, 1, 12);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 12);
    } else if (reviewPeriod === 'quarter') {
      const currentQuarterStart = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), currentQuarterStart + reviewOffset * 3, 1, 12);
      end = new Date(start.getFullYear(), start.getMonth() + 3, 0, 12);
    } else {
      start = new Date(now.getFullYear() + reviewOffset, 0, 1, 12);
      end = new Date(start.getFullYear(), 11, 31, 12);
    }
    return { start, end };
  };

  const datesBetween = (start, end) => {
    const dates = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(localDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  };

  const periodBuckets = () => {
    const { start, end } = periodBounds();
    if (reviewPeriod === 'week') {
      return datesBetween(start, end).map((date, index) => ({
        label: t().dayNames[index].replace(/^周/, ''),
        dateKeys: [date],
      }));
    }
    if (reviewPeriod === 'month') {
      const buckets = [];
      for (let day = 1; day <= end.getDate(); day += 6) {
        const bucketStart = new Date(start.getFullYear(), start.getMonth(), day, 12);
        const bucketEnd = new Date(start.getFullYear(), start.getMonth(), Math.min(day + 5, end.getDate()), 12);
        buckets.push({
          label: day === bucketEnd.getDate() ? String(day) : `${day}–${bucketEnd.getDate()}`,
          dateKeys: datesBetween(bucketStart, bucketEnd),
        });
      }
      return buckets;
    }
    const monthCount = reviewPeriod === 'quarter' ? 3 : 12;
    return Array.from({ length: monthCount }, (_, index) => {
      const monthStart = new Date(start.getFullYear(), start.getMonth() + index, 1, 12);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 12);
      return {
        label: state.language === 'zh'
          ? `${monthStart.getMonth() + 1}月`
          : new Intl.DateTimeFormat('en-US', { month: 'short' }).format(monthStart),
        dateKeys: datesBetween(monthStart, monthEnd),
      };
    });
  };

  const aggregateHabitStatus = (bucket, habitId) => {
    const statuses = bucket.dateKeys
      .map((date) => historyStatus(date, habitId))
      .filter((status) => status !== 'none');
    if (!statuses.length) return 'none';
    return statuses.some((status) => status === 'recorded') ? 'recorded' : 'complete';
  };

  const renderPeriodHeader = () => {
    document.querySelectorAll('.period-button').forEach((button) => {
      const selected = button.dataset.period === reviewPeriod;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const { start, end } = periodBounds();
    document.getElementById('period-caption').textContent = reviewOffset === 0
      ? t().periodNames[reviewPeriod]
      : `${reviewOffset > 0 ? '+' : ''}${reviewOffset}`;
    document.getElementById('period-range').textContent = reviewPeriod === 'year'
      ? String(start.getFullYear())
      : `${formatShortDate(start)} → ${formatShortDate(end)}`;
  };

  const timeToMinutes = (value) => {
    const [hours, minutes] = String(value).split(':').map(Number);
    return hours * 60 + minutes;
  };

  const average = (values) => values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;

  const averageTime = (values, isBedtime = false) => {
    const minutes = values.map((value) => {
      const result = timeToMinutes(value);
      return isBedtime && result < 12 * 60 ? result + 24 * 60 : result;
    });
    return average(minutes);
  };

  const formatTimeMinutes = (minutes) => {
    if (!Number.isFinite(minutes)) return '';
    const normalized = Math.round(minutes) % (24 * 60);
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
  };

  const chartX = (index, count) => count <= 1 ? 196 : 74 + index * (264 / (count - 1));

  const chartYScale = (values, plan, top, bottom, minimumSpan) => {
    const available = values.filter((value) => Number.isFinite(value));
    const lowest = Math.min(plan, ...available);
    const highest = Math.max(plan, ...available);
    const span = Math.max(minimumSpan, highest - lowest + 30);
    const center = (lowest + highest) / 2;
    const minimum = center - span / 2;
    return (value) => top + (value - minimum) / span * (bottom - top);
  };

  const renderSleepChart = () => {
    const buckets = periodBuckets();
    const sleepHabit = state.habits.find((habit) => habit.id === 'sleep');
    const wakeHabit = state.habits.find((habit) => habit.id === 'wake');
    const bedPlanMinutes = normalizedBedtimeMinutes(sleepHabit?.target || '23:30');
    const wakePlanMinutes = timeToMinutes(wakeHabit?.target || '07:00');
    const bedValues = buckets.map((bucket) => averageTime(
      bucket.dateKeys.map((date) => state.history?.[date]?.sleep?.value).filter(Boolean),
      true,
    ));
    const wakeValues = buckets.map((bucket) => averageTime(
      bucket.dateKeys.map((date) => state.history?.[date]?.wake?.value).filter(Boolean),
    ));
    const x = (index) => chartX(index, buckets.length);
    const wakeY = chartYScale(wakeValues, wakePlanMinutes, 22, 66, 75);
    const bedY = chartYScale(bedValues, bedPlanMinutes, 96, 140, 90);
    const bedPlanY = bedY(bedPlanMinutes);
    const wakePlanY = wakeY(wakePlanMinutes);
    const bedPoints = bedValues.map((value, index) => Number.isFinite(value) ? `${x(index)},${bedY(value)}` : '').filter(Boolean).join(' ');
    const wakePoints = wakeValues.map((value, index) => Number.isFinite(value) ? `${x(index)},${wakeY(value)}` : '').filter(Boolean).join(' ');
    elements.sleepChart.setAttribute('aria-label', `${t().actualBedtime}, ${t().actualWake}`);
    elements.sleepChart.innerHTML = `
      <line class="chart-plan" x1="54" y1="${wakePlanY}" x2="340" y2="${wakePlanY}"></line>
      <text class="chart-axis-label is-plan-label" x="49" y="${wakePlanY + 3}" text-anchor="end">${formatTimeMinutes(wakePlanMinutes)}</text>
      <line class="chart-plan" x1="54" y1="${bedPlanY}" x2="340" y2="${bedPlanY}"></line>
      <text class="chart-axis-label is-plan-label" x="49" y="${bedPlanY + 3}" text-anchor="end">${formatTimeMinutes(bedPlanMinutes)}</text>
      <polyline class="chart-line" points="${wakePoints}"></polyline>
      <polyline class="chart-line-wake" points="${bedPoints}"></polyline>
      ${wakeValues.map((value, index) => Number.isFinite(value) ? `
        <circle class="chart-point" cx="${x(index)}" cy="${wakeY(value)}" r="4"></circle>
        <text class="chart-value-label" x="${x(index)}" y="${wakeY(value) - 7}" text-anchor="middle">${formatTimeMinutes(value)}</text>
      ` : '').join('')}
      ${bedValues.map((value, index) => Number.isFinite(value) ? `
        <circle class="chart-point-wake" cx="${x(index)}" cy="${bedY(value)}" r="4"></circle>
        <text class="chart-value-label" x="${x(index)}" y="${bedY(value) - 7}" text-anchor="middle">${formatTimeMinutes(value)}</text>
      ` : '').join('')}
      ${buckets.map((bucket, index) => `<text class="chart-label" x="${x(index)}" y="166" text-anchor="middle">${bucket.label}</text>`).join('')}
    `;
  };

  const renderWeightChart = () => {
    const buckets = periodBuckets();
    const values = buckets.map((bucket) => average(
      bucket.dateKeys
        .map((date) => state.history?.[date]?.weight?.value)
        .filter((value) => Number.isFinite(value)),
    ));
    const numericValues = values.filter((value) => Number.isFinite(value));
    const chartValues = numericValues.length ? numericValues : [70.5, 70.8];
    const min = Math.min(...chartValues) - 0.15;
    const max = Math.max(...chartValues) + 0.15;
    const x = (index) => chartX(index, buckets.length);
    const y = (value) => 20 + (max - value) / Math.max(0.1, max - min) * 108;
    elements.weightChart.setAttribute('aria-label', t().weightTrend);
    elements.weightChart.innerHTML = `
      <polyline class="chart-line" points="${values.map((value, index) => Number.isFinite(value) ? `${x(index)},${y(value)}` : '').filter(Boolean).join(' ')}"></polyline>
      ${values.map((value, index) => Number.isFinite(value) ? `
        <circle class="chart-point" cx="${x(index)}" cy="${y(value)}" r="4"></circle>
        <text class="chart-value-label" x="${x(index)}" y="${y(value) - 8}" text-anchor="middle">${value.toFixed(1)}</text>
      ` : '').join('')}
      ${buckets.map((bucket, index) => `<text class="chart-label" x="${x(index)}" y="157" text-anchor="middle">${bucket.label}</text>`).join('')}
    `;
  };

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const recordDateParts = (createdAt) => {
    const date = new Date(createdAt);
    return {
      month: `${date.getMonth() + 1}月`,
      day: date.getDate(),
      weekday: new Intl.DateTimeFormat(state.language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' }).format(date),
      full: new Intl.DateTimeFormat(state.language === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
      }).format(date),
    };
  };

  const recordMetricText = (record) => {
    if (record.type === 'reading') {
      return `${record.metrics?.minutes || 0} 分钟 · ${record.metrics?.pages || 0} 页`;
    }
    if (record.type === 'dream') return '梦境原文 · AI 解读';
    return `${record.metrics?.activityType || '运动'} · ${record.metrics?.minutes || 0} 分钟`;
  };

  const recordTypeLabel = (type) => {
    if (type === 'reading') return t().readingRecords;
    if (type === 'dream') return t().dreamRecords;
    return t().workoutRecords;
  };

  const recordFallbackTitle = (record) => {
    if (record.type === 'reading') return '阅读记录';
    if (record.type === 'dream') return '梦境记录';
    return '运动记录';
  };

  const recordImageSources = (record) => {
    const directImages = Array.isArray(record.images) ? record.images.filter(Boolean) : [];
    const storedImages = (record.imageIds || []).map((id) => mediaUrlCache.get(id)).filter(Boolean);
    return [...new Set([...directImages, ...storedImages])].slice(0, 9);
  };

  const recordImagesMarkup = (record, detail = false) => {
    const images = recordImageSources(record);
    if (!images.length) return '';
    if (detail) {
      return `
        <div class="record-detail-images">
          ${images.map((src, index) => `
            <button type="button" data-record-image="${index}" aria-label="放大图片 ${index + 1}">
              <img src="${escapeHtml(src)}" alt="记录图片 ${index + 1}">
            </button>
          `).join('')}
        </div>
      `;
    }
    return `
      <span class="record-image-stack" aria-label="${images.length} 张图片">
        ${images.slice(0, 3).map((src, index) => `<img src="${escapeHtml(src)}" alt="" style="--stack-index:${index}">`).join('')}
        ${images.length > 3 ? `<b>+${images.length - 3}</b>` : ''}
      </span>
    `;
  };

  const recordEntryMarkup = (record) => {
    const date = recordDateParts(record.createdAt);
    const summary = record.content || record.summary || record.sourceText || '';
    return `
      <button class="record-entry" type="button" data-record-id="${escapeHtml(record.id)}">
        <span class="record-entry-date"><small>${date.month}</small><strong>${date.day}</strong><small>${date.weekday}</small></span>
        <span class="record-entry-copy">
          <strong>${escapeHtml(record.title || recordFallbackTitle(record))}</strong>
          <span>${escapeHtml(summary)}</span>
          <small><i class="record-type-dot is-${record.type}"></i>${escapeHtml(recordTypeLabel(record.type))} · ${escapeHtml(recordMetricText(record))}</small>
        </span>
        ${recordImagesMarkup(record)}
      </button>
    `;
  };

  const renderRecords = () => {
    document.querySelectorAll('[data-record-filter]').forEach((button) => {
      const selected = button.dataset.recordFilter === recordFilter;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const types = recordFilter === 'all' ? ['reading', 'workout', 'dream'] : [recordFilter];
    elements.recordSections.innerHTML = types.map((type) => {
      const records = state.records
        .filter((record) => record.type === type)
        .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
      const label = recordTypeLabel(type);
      const description = type === 'reading'
        ? '摘录、当下感悟与心情记录'
        : type === 'dream'
          ? '梦境、情绪与潜意识线索'
          : '锻炼、身体感受与结伴同行';
      return `
        <section class="record-section">
          <header class="record-section-heading">
            <div><h2>${label}</h2><p>${description}</p></div>
            <span>${records.length} 篇</span>
          </header>
          <div class="record-list">
            ${records.length ? records.map(recordEntryMarkup).join('') : `<p class="record-empty">${t().noData}</p>`}
          </div>
        </section>
      `;
    }).join('');
  };

  const showRecordLightbox = (src) => {
    const lightbox = document.createElement('div');
    lightbox.className = 'reading-lightbox';
    lightbox.innerHTML = `
      <button type="button" class="reading-lightbox-close" aria-label="关闭大图">×</button>
      <img src="${escapeHtml(src)}" alt="放大的记录图片">
    `;
    lightbox.querySelector('button').addEventListener('click', () => lightbox.remove());
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) lightbox.remove();
    });
    elements.sheet.appendChild(lightbox);
  };

  const openRecordDetail = (recordId) => {
    const record = state.records.find((item) => item.id === recordId);
    if (!record) return;
    const date = recordDateParts(record.createdAt);
    activeHabitId = null;
    readingSession = null;
    pendingWorkoutSession = null;
    document.getElementById('sheet-title').textContent = record.title || recordFallbackTitle(record);
    const saveButton = document.querySelector('#checkin-form > .save-button');
    saveButton.hidden = true;
    elements.result.textContent = '';
    elements.fields.innerHTML = `
      <article class="record-detail">
        <p class="record-detail-date">${escapeHtml(date.full)} · ${escapeHtml(recordMetricText(record))}</p>
        ${recordImagesMarkup(record, true)}
        ${record.type === 'workout' && record.content ? `<section><h3>身体感受/训练内容</h3><p class="record-detail-source">${escapeHtml(record.content)}</p></section>` : ''}
        ${record.type !== 'workout' && record.summary ? `<section><h3>${record.type === 'reading' ? '我的感悟' : 'AI 解读（已由用户确认）'}</h3><p>${escapeHtml(record.summary)}</p></section>` : ''}
        ${record.type !== 'workout' && record.sourceText ? `<section><h3>${record.type === 'reading' ? '摘录原文' : '我的梦境'}</h3><p class="record-detail-source">${escapeHtml(record.sourceText)}</p></section>` : ''}
        ${record.type === 'dream' ? '<p class="record-detail-note">AI 解读仅用于自我记录与联想，不代表诊断或预言。</p>' : ''}
      </article>
    `;
    elements.fields.onclick = (event) => {
      const imageButton = event.target.closest('[data-record-image]');
      if (!imageButton) return;
      const src = recordImageSources(record)[Number(imageButton.dataset.recordImage)];
      if (src) showRecordLightbox(src);
    };
    openLayer(elements.sheet);
  };

  const renderManagedHabits = () => {
    elements.managedHabitList.innerHTML = state.habits.map((habit) => `
      <article class="managed-habit ${habit.hidden ? 'is-hidden-habit' : ''}" data-managed-habit="${habit.id}">
        <button class="drag-handle" type="button" aria-label="${t().dragHint}" data-drag-handle="${habit.id}">≡</button>
        <span class="habit-icon">${iconMarkup(habit.icon)}</span>
        <div>
          <span class="managed-habit-name">${habitName(habit)}</span>
          <span class="managed-habit-meta">${habit.hidden ? (state.language === 'zh' ? '已从今天隐藏 · ' : 'Hidden from Today · ') : ''}${formatFrequency(habit.frequency)} · ${habit.kind === 'custom' ? (habit.quantified ? t().quantified(t().metricLabels[habit.metricType]) : t().simpleCheckin) : t().trackingLabels[habit.id]}</span>
        </div>
        <div class="habit-actions">
          <button class="edit-habit-button" type="button" data-habit-menu="${habit.id}" aria-label="习惯操作">•••</button>
          <div class="habit-action-menu" data-menu-for="${habit.id}" hidden>
            <button type="button" data-edit-habit="${habit.id}">编辑</button>
            <button type="button" data-toggle-hidden="${habit.id}">${habit.hidden ? '取消隐藏' : '隐藏'}</button>
            <button class="danger-action" type="button" data-delete-habit="${habit.id}">删除</button>
          </div>
        </div>
      </article>
    `).join('');
  };

  const renderModelSettings = () => {
    elements.modelSettingsList.innerHTML = AI_MODELS.map((model) => {
      const selected = state.defaultAiModel === model.id;
      return `
        <button class="model-setting-option ${selected ? 'is-selected' : ''}" type="button" data-default-ai-model="${model.id}" aria-pressed="${selected}">
          <span class="model-setting-radio" aria-hidden="true"></span>
          <span><strong>${state.language === 'zh' ? model.labelZh : model.labelEn}</strong><small>${model.id}</small></span>
          <b>${selected ? (state.language === 'zh' ? '默认' : 'Default') : ''}</b>
        </button>
      `;
    }).join('');
  };

  const renderCopy = () => {
    document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const value = t()[element.dataset.i18n];
      if (typeof value === 'string') element.textContent = value;
    });
    const hour = new Date().getHours();
    const greetingKey = hour >= 5 && hour < 12
      ? 'morningGreeting'
      : hour >= 12 && hour < 18
        ? 'afternoonGreeting'
        : 'eveningGreeting';
    document.getElementById('today-title').textContent = state.language === 'zh'
      ? `${t()[greetingKey]}，Donna ☀️`
      : `${t()[greetingKey]}, Donna ☀️`;
    document.getElementById('language-button').textContent = state.language === 'zh' ? 'EN' : '中';
    document.getElementById('habit-name').placeholder = state.language === 'zh' ? '例如：冥想' : 'e.g. Meditation';
    document.querySelectorAll('.icon-choice[data-icon]').forEach((button) => {
      button.innerHTML = iconMarkup(button.dataset.icon);
    });
    renderFallbackIcons();
    renderWeekdayChoices();
  };

  const renderDate = () => {
    const options = state.language === 'zh'
      ? { month: 'long', day: 'numeric', weekday: 'long' }
      : { month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('today-date').textContent = new Intl.DateTimeFormat(state.language === 'zh' ? 'zh-CN' : 'en-US', options).format(new Date());
    const selectedKey = selectedDateKey();
    const actualTodayKey = localDateKey(new Date());
    const isToday = selectedKey === actualTodayKey;
    const selectedLabel = new Intl.DateTimeFormat(state.language === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'numeric', day: 'numeric', ...(isToday ? {} : { weekday: 'short' }),
    }).format(selectedTodayDate);
    document.getElementById('habit-heading').textContent = isToday
      ? t().today
      : state.language === 'zh' ? '补打卡' : 'Backfill';
    document.getElementById('today-selected-date').textContent = selectedLabel;
    const dateInput = document.getElementById('today-date-input');
    dateInput.value = selectedKey;
    dateInput.max = actualTodayKey;
    document.getElementById('next-today-date').disabled = selectedKey >= actualTodayKey;
    const quotes = state.language === 'zh'
      ? ['慢慢来，你正在成为自己喜欢的样子。', '每一次真实记录，都是在认真照顾自己。', '今天不必完美，只需要继续。']
      : ['Take your time. You are becoming someone you like.', 'Every honest record is a way of caring for yourself.', 'Today does not need to be perfect. Just keep going.'];
    document.getElementById('daily-quote').textContent = quotes[new Date().getDate() % quotes.length];
  };

  const renderAll = () => {
    syncTodayHabitState();
    renderCopy();
    renderDate();
    renderToday();
    renderReview();
    renderRecords();
    renderManagedHabits();
    renderModelSettings();
  };

  const selectTodayDate = (date) => {
    const actualToday = dateFromKey(localDateKey(new Date()));
    selectedTodayDate = date > actualToday ? actualToday : date;
    closeLayers();
    renderAll();
  };

  const openLayer = (layer) => {
    elements.scrim.hidden = false;
    layer.hidden = false;
    document.body.style.overflow = 'hidden';
  };

  const closeLayers = () => {
    elements.scrim.hidden = true;
    elements.sheet.hidden = true;
    elements.habitSheet.hidden = true;
    document.body.style.overflow = '';
    activeHabitId = null;
    readingSession = null;
    pendingWorkoutSession = null;
    dreamSession = null;
  };

  const field = (label, input) => `<div class="field"><label>${label}</label>${input}</div>`;

  const hasOptionalContent = (habit) => Object.values(habit.recordOptions || {}).some(Boolean);

  const optionalCheckinFields = (habit) => {
    const options = habit.recordOptions || {};
    if (!Object.values(options).some(Boolean)) return '';
    const noteLabel = habit.kind === 'workout' ? '身体感受/训练内容' : t().textNote;
    const notePlaceholder = habit.kind === 'workout'
      ? '记录训练内容、身体感受或同行的人…'
      : t().notePlaceholder;
    return `
      <div class="field">
        <label for="record-note">${noteLabel}</label>
        <div class="note-composer">
          <textarea class="note-textarea" id="record-note" placeholder="${notePlaceholder}">${habit.note || ''}</textarea>
          <div class="note-actions">
            <label class="attachment-button" for="record-photo">▧ ${t().photo}</label>
            <input id="record-photo" type="file" accept="image/*" hidden>
            <button class="voice-prototype-button" id="voice-prototype-button" type="button">◉ ${t().voice}</button>
          </div>
          <img class="attachment-preview" id="attachment-preview" alt="" hidden>
          <section class="ai-recognition-panel" id="ai-recognition-panel" hidden>
            <div class="ai-panel-heading">
              <strong>${t().aiImageRecognition}</strong>
              <span>${t().aiRecognitionHint}</span>
            </div>
            <div class="ai-token-fields" id="ai-token-fields">
              <label for="ai-access-token">${t().aiAccessToken}</label>
              <input id="ai-access-token" type="password" autocomplete="off" placeholder="${t().aiAccessToken}">
              <label class="ai-remember-choice">
                <input id="ai-remember-token" type="checkbox">
                <span>${t().rememberOnDevice}</span>
              </label>
              <small>${t().aiAccessTokenHint}</small>
            </div>
            <div class="ai-controls">
              <select id="ai-model" aria-label="${t().aiImageRecognition}">
                ${AI_MODELS.map((model) => `<option value="${model.id}" ${state.defaultAiModel === model.id ? 'selected' : ''}>${state.language === 'zh' ? model.labelZh : model.labelEn}</option>`).join('')}
              </select>
              <button class="ai-recognize-button" id="ai-recognize-button" type="button">${t().recognizeImage}</button>
            </div>
            <p class="ai-status" id="ai-status" aria-live="polite"></p>
            <div class="ai-results" id="ai-results"></div>
          </section>
        </div>
      </div>
    `;
  };

  const fileToCompressedDataUrl = (file, maxEdge = 1280, quality = 0.85) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('image_failed'));
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

  const resultValue = (result) => {
    if (!Array.isArray(result?.values)) return null;
    return result.values.find((item) => Number.isFinite(Number(item?.value)));
  };

  const renderAiResults = (habit) => {
    const container = document.getElementById('ai-results');
    if (!container) return;
    container.replaceChildren();
    AI_MODELS.forEach((model) => {
      const result = aiRecognitionResults.get(model.id);
      if (!result) return;
      const card = document.createElement('article');
      card.className = 'ai-result-card';

      const title = document.createElement('strong');
      title.textContent = state.language === 'zh' ? model.labelZh : model.labelEn;
      card.appendChild(title);

      const description = document.createElement('p');
      description.className = 'ai-description';
      description.textContent = result.description || t().noExtraDetails;
      card.appendChild(description);

      const metaItems = [];
      if (result.detected_text) metaItems.push(`${t().detectedText}：${result.detected_text}`);
      if (Array.isArray(result.uncertainties) && result.uncertainties.length) {
        metaItems.push(`${t().uncertainties}：${result.uncertainties.join('、')}`);
      }
      if (result.confidence !== undefined) {
        const confidenceLabels = state.language === 'zh'
          ? { high: '高', medium: '中', low: '低' }
          : { high: 'High', medium: 'Medium', low: 'Low' };
        const confidenceText = confidenceLabels[result.confidence] || String(result.confidence);
        metaItems.push(`${t().confidence}：${confidenceText}`);
      }
      if (metaItems.length) {
        const meta = document.createElement('p');
        meta.className = 'ai-result-meta';
        meta.textContent = metaItems.join('\n');
        card.appendChild(meta);
      }

      const actions = document.createElement('div');
      actions.className = 'ai-result-actions';
      const useNote = document.createElement('button');
      useNote.type = 'button';
      useNote.textContent = t().useAsNote;
      useNote.addEventListener('click', () => {
        const note = document.getElementById('record-note');
        if (note) note.value = `${note.value}${note.value ? '\n' : ''}${result.description || ''}`.trim();
        document.getElementById('ai-status').textContent = t().resultWritten;
      });
      actions.appendChild(useNote);

      const detectedValue = resultValue(result);
      const valueInput = habit.kind === 'weight'
        ? document.getElementById('weight-value')
        : habit.kind === 'custom' ? document.getElementById('custom-value') : null;
      if (detectedValue && valueInput) {
        const useValue = document.createElement('button');
        useValue.type = 'button';
        useValue.textContent = `${t().useDetectedValue} ${detectedValue.value}${detectedValue.unit ? ` ${detectedValue.unit}` : ''}`;
        useValue.addEventListener('click', () => {
          valueInput.value = String(detectedValue.value);
        });
        actions.appendChild(useValue);
      }
      card.appendChild(actions);
      container.appendChild(card);
    });
  };

  const analyzeSelectedImage = async (habit) => {
    const status = document.getElementById('ai-status');
    const button = document.getElementById('ai-recognize-button');
    const tokenInput = document.getElementById('ai-access-token');
    const remember = document.getElementById('ai-remember-token');
    const model = document.getElementById('ai-model').value;
    const token = tokenInput.value.trim();
    if (!selectedCheckinImageDataUrl) {
      status.textContent = t().selectPhotoFirst;
      return;
    }
    if (!token) {
      status.textContent = t().tokenRequired;
      tokenInput.focus();
      return;
    }
    if (remember.checked) localStorage.setItem(AI_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(AI_TOKEN_STORAGE_KEY);
    button.disabled = true;
    button.textContent = t().recognizing;
    status.textContent = t().recognizing;
    try {
      const response = await fetch(`${AI_ENDPOINT}/api/analyze-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bloom-Access-Token': token,
        },
        body: JSON.stringify({
          model,
          context: habitName(habit),
          imageDataUrl: selectedCheckinImageDataUrl,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      aiRecognitionResults.set(model, payload.result || payload);
      renderAiResults(habit);
      status.textContent = '';
    } catch (error) {
      status.textContent = `${t().recognitionFailed}（${error.message}）`;
    } finally {
      button.disabled = false;
      button.textContent = t().recognizeImage;
    }
  };

  const setupOptionalInputs = (habit) => {
    const photoInput = document.getElementById('record-photo');
    if (photoInput) {
      photoInput.addEventListener('change', async () => {
        const file = photoInput.files?.[0];
        if (!file) return;
        const preview = document.getElementById('attachment-preview');
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
        const panel = document.getElementById('ai-recognition-panel');
        const status = document.getElementById('ai-status');
        panel.hidden = false;
        status.textContent = '';
        try {
          selectedCheckinImageDataUrl = await fileToCompressedDataUrl(file);
        } catch {
          selectedCheckinImageDataUrl = '';
          status.textContent = t().recognitionFailed;
        }
      });
    }
    const savedToken = localStorage.getItem(AI_TOKEN_STORAGE_KEY) || '';
    const tokenInput = document.getElementById('ai-access-token');
    const remember = document.getElementById('ai-remember-token');
    if (tokenInput) tokenInput.value = savedToken;
    if (remember) remember.checked = true;
    const persistTokenChoice = () => {
      const token = tokenInput?.value.trim() || '';
      if (remember?.checked && token) localStorage.setItem(AI_TOKEN_STORAGE_KEY, token);
      else localStorage.removeItem(AI_TOKEN_STORAGE_KEY);
    };
    tokenInput?.addEventListener('change', persistTokenChoice);
    remember?.addEventListener('change', persistTokenChoice);
    document.getElementById('ai-recognize-button')?.addEventListener('click', () => analyzeSelectedImage(habit));
    const voiceButton = document.getElementById('voice-prototype-button');
    if (voiceButton) {
      voiceButton.addEventListener('click', () => {
        voiceButton.textContent = t().voiceAdded;
        const note = document.getElementById('record-note');
        if (note) note.value = `${note.value}${note.value ? '\n' : ''}[${t().voiceAdded}]`;
      });
    }
  };

  const readingModelOptions = () => AI_MODELS.map((model) => `
    <option value="${model.id}" ${readingSession.model === model.id ? 'selected' : ''}>${state.language === 'zh' ? model.labelZh : model.labelEn}</option>
  `).join('');

  const readingPhotoCards = () => readingSession.images.map((image, index) => `
    <article class="reading-photo-card">
      <button class="reading-photo-preview" type="button" data-reading-action="enlarge" data-image-id="${image.id}" aria-label="放大图片 ${index + 1}">
        <img src="${image.dataUrl}" alt="阅读图片 ${index + 1}">
      </button>
      <span class="reading-photo-index">${index + 1}</span>
      <button class="reading-photo-remove" type="button" data-reading-action="remove-image" data-image-id="${image.id}" aria-label="删除图片 ${index + 1}">×</button>
    </article>
  `).join('');

  const readingStepNavigation = () => {
    const labels = [
      ['photos', '图片'],
      ['source', '原文'],
      ['reflection', '感悟'],
      ['preview', '保存'],
    ];
    return `
      <nav class="reading-steps" aria-label="阅读记录步骤">
        ${labels.map(([step, label], index) => `
          <button class="reading-step ${readingSession.step === step ? 'is-active' : ''}" type="button" data-reading-action="step" data-step="${step}">
            <span>${index + 1}</span>${label}
          </button>
        `).join('')}
      </nav>
    `;
  };

  const mergedReadingSource = () => readingSession.images
    .map((image) => (readingSession.ocrByImage.get(image.id) || '').trim())
    .filter(Boolean)
    .join('\n\n');

  const saveActiveReadingSource = () => {
    const editor = document.getElementById('reading-source-editor');
    if (!editor) return;
    if (readingSession.activeSourceId === 'all') readingSession.mergedSource = editor.value;
    else readingSession.ocrByImage.set(readingSession.activeSourceId, editor.value);
  };

  const confirmCompleteReadingSource = () => {
    saveActiveReadingSource();
    if (readingSession.activeSourceId !== 'all') {
      readingSession.mergedSource = mergedReadingSource();
    }
    readingSession.confirmedSource = (
      readingSession.mergedSource || mergedReadingSource()
    ).trim();
    return readingSession.confirmedSource;
  };

  const renderReadingLightbox = (imageId) => {
    const image = readingSession.images.find((item) => item.id === imageId);
    if (!image) return;
    const lightbox = document.createElement('div');
    lightbox.className = 'reading-lightbox';
    lightbox.innerHTML = `
      <button type="button" class="reading-lightbox-close" aria-label="关闭大图">×</button>
      <img src="${image.dataUrl}" alt="放大的阅读图片">
    `;
    lightbox.querySelector('button').addEventListener('click', () => lightbox.remove());
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) lightbox.remove();
    });
    elements.sheet.appendChild(lightbox);
  };

  const renderReadingPhotos = () => {
    const token = localStorage.getItem(AI_TOKEN_STORAGE_KEY) || '';
    elements.fields.innerHTML = `
      <div class="reading-flow">
        ${readingStepNavigation()}
        <div class="field-pair">
          ${field(t().minutes, `<input id="reading-minutes" type="number" min="0" value="${readingSession.minutes}" required>`)}
          ${field(t().pages, `<input id="reading-pages" type="number" min="0" value="${readingSession.pages}" required>`)}
        </div>
        <section class="reading-panel">
          <div class="reading-section-head">
            <div><strong>阅读图片</strong><small>支持相册或拍照，最多 9 张</small></div>
            <span>${readingSession.images.length} / 9</span>
          </div>
          <div class="reading-photo-grid">
            ${readingPhotoCards()}
            ${readingSession.images.length < 9 ? '<label class="reading-add-photo" for="reading-photo-input">＋<span>添加图片</span></label>' : ''}
          </div>
          <input id="reading-photo-input" type="file" accept="image/*" multiple hidden>
        </section>
        <section class="reading-ai-access">
          ${token
            ? '<span class="reading-connected">✓ AI 服务已连接</span>'
            : '<label for="reading-access-token">Bloom 测试密码</label><input id="reading-access-token" type="password" autocomplete="off">'}
          <select id="reading-model">${readingModelOptions()}</select>
        </section>
        <p class="reading-status" id="reading-status" aria-live="polite">${readingSession.status || ''}</p>
        <button class="reading-primary-button" type="button" data-reading-action="ocr" ${readingSession.images.length ? '' : 'disabled'}>
          ${readingSession.loading ? '正在识别全部图片…' : '识别全部图片'}
        </button>
      </div>
    `;
  };

  const renderReadingChoice = () => {
    elements.fields.innerHTML = `
      <div class="reading-entry">
        <div class="field-pair">
          ${field(t().minutes, `<input id="reading-minutes" type="number" min="0" value="${readingSession.minutes}" required>`)}
          ${field(t().pages, `<input id="reading-pages" type="number" min="0" value="${readingSession.pages}" required>`)}
        </div>
        <div class="reading-entry-actions">
          <button type="button" data-reading-action="expand-reading">添加图片和感悟</button>
          <button class="reading-primary-button" type="button" data-reading-action="direct-save">直接保存</button>
        </div>
      </div>
    `;
  };

  const renderReadingSource = () => {
    if (
      !readingSession.activeSourceId
      || (
        readingSession.activeSourceId !== 'all'
        && !readingSession.images.some((image) => image.id === readingSession.activeSourceId)
      )
    ) {
      readingSession.activeSourceId = readingSession.images[0]?.id || 'all';
    }
    const isMerged = readingSession.activeSourceId === 'all';
    const activeText = isMerged
      ? readingSession.mergedSource || mergedReadingSource()
      : readingSession.ocrByImage.get(readingSession.activeSourceId) || '';
    const activeIndex = readingSession.images.findIndex((image) => image.id === readingSession.activeSourceId);
    elements.fields.innerHTML = `
      <div class="reading-flow">
        ${readingStepNavigation()}
        <section class="reading-panel">
          <div class="reading-section-head">
            <div><strong>逐张校对原文</strong><small>切换图片时会自动保留修改</small></div>
            <span>OCR 完成</span>
          </div>
          <div class="reading-source-tabs">
            ${readingSession.images.map((image, index) => `
              <button class="${readingSession.activeSourceId === image.id ? 'is-active' : ''}" type="button" data-reading-action="source-tab" data-image-id="${image.id}">图片 ${index + 1}</button>
            `).join('')}
            <button class="${isMerged ? 'is-active' : ''}" type="button" data-reading-action="merge-source">合并原文</button>
          </div>
          <textarea id="reading-source-editor" class="reading-source-editor"></textarea>
          <p class="reading-helper">${isMerged ? '这是按图片顺序合并的完整原文，仍可继续最终修改。' : `正在对照图片 ${activeIndex + 1} 修改原文。`}</p>
        </section>
        <button class="reading-primary-button" type="button" data-reading-action="go-reflection">原文修改完成</button>
      </div>
    `;
    document.getElementById('reading-source-editor').value = activeText;
  };

  const renderReadingReflection = () => {
    elements.fields.innerHTML = `
      <div class="reading-flow">
        ${readingStepNavigation()}
        <section class="reading-panel">
          <div class="reading-section-head">
            <div><strong>我的感悟</strong><small>自己写，或让 AI 提供一个简短起点</small></div>
            <button type="button" data-reading-action="ai-reflection">${readingSession.loading ? '生成中…' : 'AI 辅助'}</button>
          </div>
          <textarea id="reading-reflection-editor" class="reading-reflection-editor" placeholder="写下此刻真正打动你的内容……"></textarea>
          <p class="reading-helper">AI 将基于你在“原文”页最终确认的完整合并原文生成初稿；初稿可以删除、重写。</p>
        </section>
        <p class="reading-status" id="reading-status" aria-live="polite">${readingSession.status || ''}</p>
        <button class="reading-primary-button" type="button" data-reading-action="go-preview">预览完整记录</button>
      </div>
    `;
    document.getElementById('reading-reflection-editor').value = readingSession.reflection;
  };

  const fallbackRecordTitle = (type, sourceText, reflection, activityType = '') => {
    const content = (reflection || sourceText || '').replace(/\s+/g, ' ').trim();
    if (content) {
      const firstSentence = content.split(/[。！？!?；;\n]/)[0].trim();
      if (firstSentence) return firstSentence.slice(0, 22);
    }
    if (type === 'reading') return '今天的阅读片段';
    return activityType ? `${activityType}后的记录` : '今天的运动记录';
  };

  const requestRecordTitle = async ({ type, sourceText, reflection, metrics, model }) => {
    const token = localStorage.getItem(AI_TOKEN_STORAGE_KEY) || '';
    if (!token) throw new Error('未连接 AI 服务');
    const response = await fetch(`${AI_ENDPOINT}/api/record/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bloom-Access-Token': token },
      body: JSON.stringify({ type, sourceText, reflection, metrics, model }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return String(payload.title || '').trim();
  };

  const syncReadingTitle = () => {
    const input = document.getElementById('reading-record-title');
    if (input) readingSession.title = input.value.trim();
  };

  const runReadingTitle = async () => {
    syncReadingTitle();
    readingSession.titleLoading = true;
    readingSession.titleStatus = 'AI 正在生成标题建议…';
    renderReadingPreview(false);
    try {
      const title = await requestRecordTitle({
        type: 'reading',
        sourceText: readingSession.confirmedSource || confirmCompleteReadingSource(),
        reflection: readingSession.reflection,
        metrics: `${readingSession.minutes} 分钟，${readingSession.pages} 页`,
        model: readingSession.model,
      });
      if (title) readingSession.title = title;
      readingSession.titleStatus = '已生成标题，你仍可以修改';
    } catch {
      readingSession.titleStatus = 'AI 暂时不可用，已保留可编辑标题，不影响保存';
    } finally {
      readingSession.titleLoading = false;
      readingSession.titleRequested = true;
      renderReadingPreview(false);
    }
  };

  const renderReadingPreview = (saved = false) => {
    const source = readingSession.mergedSource || mergedReadingSource();
    if (!readingSession.title) {
      readingSession.title = fallbackRecordTitle('reading', source, readingSession.reflection);
    }
    elements.fields.innerHTML = `
      <div class="reading-flow">
        ${saved ? '<div class="reading-success">✓ 保存成功，可在“记录”中查看</div>' : readingStepNavigation()}
        ${saved ? '' : `
          <section class="record-title-panel">
            <div class="reading-section-head">
              <div><strong>记录标题</strong><small>保存前确认；可以自己写，也可以让 AI 建议</small></div>
            </div>
            <div class="record-title-row">
              <input id="reading-record-title" maxlength="28" value="${escapeHtml(readingSession.title)}" aria-label="记录标题">
              <button type="button" data-reading-action="ai-title" ${readingSession.titleLoading ? 'disabled' : ''}>${readingSession.titleLoading ? '生成中…' : 'AI 生成标题'}</button>
            </div>
            <p class="reading-helper">${escapeHtml(readingSession.titleStatus || '最终以你确认或修改后的标题保存。')}</p>
          </section>
        `}
        <section class="reading-panel">
          <div class="reading-section-head">
            <div><strong>${saved ? escapeHtml(readingSession.title) : '阅读记录预览'}</strong><small>${saved ? new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(selectedTodayDate) : '标题、图片、原文与感悟将作为同一条记录保存'}</small></div>
            <span>${saved ? '已保存' : '未保存'}</span>
          </div>
          <div class="reading-record-section">
            <strong>图片 · ${readingSession.images.length} 张</strong>
            <div class="reading-preview-images">
              ${readingSession.images.map((image, index) => `
                <button type="button" data-reading-action="enlarge" data-image-id="${image.id}" aria-label="放大图片 ${index + 1}">
                  <img src="${image.dataUrl}" alt="阅读图片 ${index + 1}">
                </button>
              `).join('')}
            </div>
          </div>
          <div class="reading-record-section">
            <strong>摘录原文</strong>
            <p>${source ? '' : '尚未保留原文'}</p>
            <div class="reading-record-copy" id="reading-source-preview"></div>
          </div>
          <div class="reading-record-section">
            <strong>我的感悟</strong>
            <p id="reading-reflection-preview"></p>
          </div>
        </section>
        ${saved
          ? ''
          : '<div class="reading-bottom-actions"><button type="button" data-reading-action="go-reflection">返回修改</button><button class="reading-primary-button" type="button" data-reading-action="save">确认标题并保存</button></div>'}
      </div>
    `;
    document.getElementById('reading-source-preview').textContent = source;
    document.getElementById('reading-reflection-preview').textContent = readingSession.reflection || '尚未填写感悟';
  };

  const renderReadingStep = () => {
    const saveButton = document.querySelector('#checkin-form > .save-button');
    saveButton.hidden = true;
    if (readingSession.step === 'choice') renderReadingChoice();
    else if (readingSession.step === 'photos') renderReadingPhotos();
    else if (readingSession.step === 'source') renderReadingSource();
    else if (readingSession.step === 'reflection') renderReadingReflection();
    else renderReadingPreview(readingSession.step === 'saved');
  };

  const getReadingToken = () => {
    const input = document.getElementById('reading-access-token');
    const token = input?.value.trim() || localStorage.getItem(AI_TOKEN_STORAGE_KEY) || '';
    if (input && token) localStorage.setItem(AI_TOKEN_STORAGE_KEY, token);
    return token;
  };

  const runReadingOcr = async () => {
    const token = getReadingToken();
    if (!token) {
      readingSession.status = '请先输入 Bloom 测试密码';
      renderReadingPhotos();
      document.getElementById('reading-access-token')?.focus();
      return;
    }
    if (!readingSession.images.length) return;
    readingSession.loading = true;
    readingSession.status = `正在逐张识别（共 ${readingSession.images.length} 张）…`;
    renderReadingPhotos();
    try {
      const results = await Promise.all(readingSession.images.map(async (image, index) => {
        const response = await fetch(`${AI_ENDPOINT}/api/reading/ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Bloom-Access-Token': token },
          body: JSON.stringify({
            model: readingSession.model,
            images: [image.dataUrl],
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(`第 ${index + 1} 张：${payload.error || `HTTP ${response.status}`}`);
        }
        return [image.id, payload.pages?.[0]?.text || ''];
      }));
      readingSession.ocrByImage = new Map(results);
      readingSession.mergedSource = mergedReadingSource();
      readingSession.activeSourceId = readingSession.images[0].id;
      readingSession.step = 'source';
      readingSession.status = '';
    } catch (error) {
      readingSession.status = `识别失败：${error.message}`;
    } finally {
      readingSession.loading = false;
      renderReadingStep();
    }
  };

  const runReadingReflection = async () => {
    const completeSource = confirmCompleteReadingSource();
    const token = getReadingToken();
    if (!token) {
      readingSession.status = '请先回到图片页输入 Bloom 测试密码';
      renderReadingReflection();
      return;
    }
    if (!completeSource) {
      readingSession.status = '请先确认摘录原文';
      renderReadingReflection();
      return;
    }
    readingSession.loading = true;
    readingSession.status = `AI 正在阅读完整合并原文（${completeSource.length} 字）…`;
    renderReadingReflection();
    try {
      const completeSourceForAi = [
        '【Bloom 生成要求】',
        '下面是用户逐张校对、修改并最终合并确认的完整原文，不是单张图片的内容。',
        '请完整阅读全部原文，生成感悟时必须综合至少两个不同部分；同时关注前半段和后半段，不能只围绕开头或某一个片段。',
        '不要把这段生成要求写进感悟。',
        '【完整合并原文开始】',
        completeSource,
        '【完整合并原文结束】',
      ].join('\n');
      const response = await fetch(`${AI_ENDPOINT}/api/reading/reflection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Bloom-Access-Token': token },
        body: JSON.stringify({ model: readingSession.model, sourceText: completeSourceForAi }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      readingSession.reflection = payload.reflection || '';
      readingSession.status = `已基于完整合并原文（${completeSource.length} 字）生成，可继续修改`;
    } catch (error) {
      readingSession.status = `生成失败：${error.message}`;
    } finally {
      readingSession.loading = false;
      renderReadingReflection();
    }
  };

  const saveReadingRecord = async () => {
    const habit = state.habits.find((item) => item.id === activeHabitId);
    syncReadingTitle();
    readingSession.title = readingSession.title || fallbackRecordTitle(
      'reading',
      readingSession.confirmedSource || confirmCompleteReadingSource(),
      readingSession.reflection,
    );
    const previousRecords = [...state.records];
    const todayKey = selectedDateKey();
    const previousTodayHistory = state.history?.[todayKey]?.[habit.id]
      ? { ...state.history[todayKey][habit.id] }
      : null;
    const previousHabit = {
      minutes: habit.minutes,
      pages: habit.pages,
      recorded: habit.recorded,
      complete: habit.complete,
      weekDone: habit.weekDone,
      weekState: habit.weekStates[todayWeekIndex()],
      latestReadingRecord: habit.latestReadingRecord,
    };
    const wasComplete = habit.complete;
    const recordId = `reading-${Date.now()}`;
    const storedMedia = await persistRecordImages(
      recordId,
      'reading',
      readingSession.images.map((image) => image.dataUrl),
    );
    habit.minutes = readingSession.minutes;
    habit.pages = readingSession.pages;
    habit.recorded = true;
    habit.complete = habit.minutes >= habit.target;
    habit.latestReadingRecord = {
      id: recordId,
      createdAt: selectedRecordTimestamp(),
      title: readingSession.title,
      images: storedMedia.images,
      imageIds: storedMedia.imageIds,
      sourceText: readingSession.confirmedSource || confirmCompleteReadingSource(),
      reflection: readingSession.reflection,
    };
    state.records.unshift({
      id: habit.latestReadingRecord.id,
      type: 'reading',
      habitId: habit.id,
      title: readingSession.title,
      summary: readingSession.reflection,
      sourceText: habit.latestReadingRecord.sourceText,
      images: habit.latestReadingRecord.images,
      imageIds: habit.latestReadingRecord.imageIds,
      metrics: { minutes: readingSession.minutes, pages: readingSession.pages },
      createdAt: habit.latestReadingRecord.createdAt,
    });
    if (!wasComplete && habit.complete) habit.weekDone = Math.min(habit.weekTarget, habit.weekDone + 1);
    if (wasComplete && !habit.complete) habit.weekDone = Math.max(0, habit.weekDone - 1);
    habit.weekStates[todayWeekIndex()] = habit.complete ? 'complete' : 'recorded';
    recordTodayInHistory(habit);
    try {
      persist();
    } catch {
      habit.minutes = previousHabit.minutes;
      habit.pages = previousHabit.pages;
      habit.recorded = previousHabit.recorded;
      habit.complete = previousHabit.complete;
      habit.weekDone = previousHabit.weekDone;
      habit.weekStates[todayWeekIndex()] = previousHabit.weekState;
      habit.latestReadingRecord = previousHabit.latestReadingRecord;
      state.records = previousRecords;
      if (previousTodayHistory) state.history[todayKey][habit.id] = previousTodayHistory;
      else delete state.history?.[todayKey]?.[habit.id];
      readingSession.status = '图片较多，当前设备存储空间不足，请减少图片后重试';
      renderReadingPreview(false);
      return;
    }
    renderAll();
    readingSession.step = 'saved';
    renderReadingStep();
    showToast('保存成功，可在“记录”中查看');
  };

  const syncReadingMetrics = () => {
    const minutes = document.getElementById('reading-minutes');
    const pages = document.getElementById('reading-pages');
    if (minutes) readingSession.minutes = Number(minutes.value);
    if (pages) readingSession.pages = Number(pages.value);
  };

  const saveReadingDirect = () => {
    const habit = state.habits.find((item) => item.id === activeHabitId);
    const wasComplete = habit.complete;
    habit.minutes = readingSession.minutes;
    habit.pages = readingSession.pages;
    habit.recorded = true;
    habit.complete = habit.minutes >= habit.target;
    if (!wasComplete && habit.complete) habit.weekDone = Math.min(habit.weekTarget, habit.weekDone + 1);
    if (wasComplete && !habit.complete) habit.weekDone = Math.max(0, habit.weekDone - 1);
    habit.weekStates[todayWeekIndex()] = habit.complete ? 'complete' : 'recorded';
    recordTodayInHistory(habit);
    persist();
    closeLayers();
    renderAll();
    showToast(t().saved);
  };

  const setupReadingFlow = () => {
    elements.fields.onclick = (event) => {
      const action = event.target.closest('[data-reading-action]');
      if (!action) return;
      syncReadingTitle();
      const type = action.dataset.readingAction;
      if (type === 'expand-reading') {
        syncReadingMetrics();
        readingSession.step = 'photos';
        renderReadingStep();
      }
      if (type === 'direct-save') {
        syncReadingMetrics();
        saveReadingDirect();
      }
      if (type === 'enlarge') renderReadingLightbox(action.dataset.imageId);
      if (type === 'remove-image') {
        readingSession.images = readingSession.images.filter((image) => image.id !== action.dataset.imageId);
        readingSession.ocrByImage.delete(action.dataset.imageId);
        renderReadingPhotos();
      }
      if (type === 'ocr') runReadingOcr();
      if (type === 'source-tab') {
        saveActiveReadingSource();
        readingSession.activeSourceId = action.dataset.imageId;
        renderReadingSource();
      }
      if (type === 'merge-source') {
        saveActiveReadingSource();
        readingSession.mergedSource = mergedReadingSource();
        readingSession.activeSourceId = 'all';
        renderReadingSource();
      }
      if (type === 'go-reflection') {
        const reflectionEditor = document.getElementById('reading-reflection-editor');
        if (reflectionEditor) readingSession.reflection = reflectionEditor.value;
        confirmCompleteReadingSource();
        readingSession.step = 'reflection';
        renderReadingStep();
      }
      if (type === 'ai-reflection') {
        readingSession.reflection = document.getElementById('reading-reflection-editor').value;
        runReadingReflection();
      }
      if (type === 'go-preview') {
        readingSession.reflection = document.getElementById('reading-reflection-editor').value;
        readingSession.step = 'preview';
        renderReadingStep();
        if (!readingSession.titleRequested && localStorage.getItem(AI_TOKEN_STORAGE_KEY)) {
          runReadingTitle();
        }
      }
      if (type === 'ai-title') runReadingTitle();
      if (type === 'save') saveReadingRecord();
      if (type === 'step') {
        const target = action.dataset.step;
        if (target !== 'photos' && !readingSession.ocrByImage.size) {
          readingSession.status = '请先上传图片并完成识别';
          renderReadingPhotos();
          return;
        }
        const reflectionEditor = document.getElementById('reading-reflection-editor');
        if (reflectionEditor) readingSession.reflection = reflectionEditor.value;
        if (['reflection', 'preview'].includes(target)) {
          confirmCompleteReadingSource();
        } else {
          saveActiveReadingSource();
        }
        readingSession.step = target;
        renderReadingStep();
        if (target === 'preview' && !readingSession.titleRequested && localStorage.getItem(AI_TOKEN_STORAGE_KEY)) {
          runReadingTitle();
        }
      }
    };
    elements.fields.onchange = async (event) => {
      if (event.target.id === 'reading-model') readingSession.model = event.target.value;
      if (event.target.id === 'reading-minutes') readingSession.minutes = Number(event.target.value);
      if (event.target.id === 'reading-pages') readingSession.pages = Number(event.target.value);
      if (event.target.id === 'reading-photo-input') {
        const available = 9 - readingSession.images.length;
        const files = [...event.target.files].slice(0, available);
        for (const file of files) {
          try {
            const dataUrl = await fileToCompressedDataUrl(file, 1000, 0.72);
            readingSession.images.push({ id: `photo-${Date.now()}-${readingSession.images.length}`, dataUrl });
          } catch {
            readingSession.status = '有一张图片无法读取';
          }
        }
        renderReadingPhotos();
      }
    };
    renderReadingStep();
  };

  const fallbackDreamTitle = (dreamText) => {
    const concise = String(dreamText || '').replace(/\s+/g, ' ').trim();
    if (!concise) return '昨夜的梦境';
    const opening = concise.split(/[。！？!?；;]/)[0].replace(/^我梦见/, '').trim();
    return opening ? `梦见${opening}`.slice(0, 24) : '昨夜的梦境';
  };

  const renderDreamCheckin = () => {
    const token = localStorage.getItem(AI_TOKEN_STORAGE_KEY) || '';
    elements.fields.innerHTML = `
      <div class="dream-flow">
        <section class="dream-editor-card">
          <div class="reading-section-head">
            <div><strong>我的梦境</strong><small>写下记得的场景、人物、情绪或细节</small></div>
          </div>
          <textarea id="dream-text" class="dream-textarea" maxlength="8000" placeholder="我梦见……">${escapeHtml(dreamSession.dreamText)}</textarea>
        </section>
        <section class="dream-editor-card dream-ai-card">
          <div class="reading-section-head">
            <div><strong>AI 解读</strong><small>生成后可以继续修改，最终保存的是你确认的版本</small></div>
            <button id="dream-interpret-button" type="button" ${dreamSession.loading ? 'disabled' : ''}>${dreamSession.loading ? '解读中…' : 'AI 解读梦境'}</button>
          </div>
          ${token ? '' : `
            <label class="dream-token-label" for="dream-access-token">Bloom 测试密码</label>
            <input id="dream-access-token" type="password" autocomplete="off" placeholder="输入后只保存在这台设备">
          `}
          <select id="dream-model" aria-label="梦境解读模型">
            ${AI_MODELS.map((model) => `<option value="${model.id}" ${dreamSession.model === model.id ? 'selected' : ''}>${state.language === 'zh' ? model.labelZh : model.labelEn}</option>`).join('')}
          </select>
          <textarea id="dream-interpretation" class="dream-textarea dream-interpretation" maxlength="5000" placeholder="点击“AI 解读梦境”生成初稿，也可以自己填写……">${escapeHtml(dreamSession.interpretation)}</textarea>
          <p class="dream-ai-disclaimer">解读用于自我观察和联想，不代表心理诊断、事实判断或预言。</p>
          <p class="reading-status" id="dream-status" aria-live="polite">${escapeHtml(dreamSession.status)}</p>
        </section>
        <section class="dream-future-card">
          <span aria-hidden="true">✦</span>
          <div><strong>梦境画面</strong><small>未来可让 AI 根据梦境生成一张专属图片；本次暂不上传或生成图片。</small></div>
        </section>
      </div>
    `;
    document.querySelector('#checkin-form > .save-button').textContent = '保存梦境记录';
    document.getElementById('dream-text').addEventListener('input', (event) => { dreamSession.dreamText = event.target.value; });
    document.getElementById('dream-interpretation').addEventListener('input', (event) => { dreamSession.interpretation = event.target.value; });
    document.getElementById('dream-model').addEventListener('change', (event) => { dreamSession.model = event.target.value; });
    document.getElementById('dream-interpret-button').addEventListener('click', runDreamInterpretation);
  };

  const runDreamInterpretation = async () => {
    dreamSession.dreamText = document.getElementById('dream-text')?.value.trim() || dreamSession.dreamText;
    dreamSession.interpretation = document.getElementById('dream-interpretation')?.value || dreamSession.interpretation;
    dreamSession.model = document.getElementById('dream-model')?.value || dreamSession.model;
    const tokenInput = document.getElementById('dream-access-token');
    const token = tokenInput?.value.trim() || localStorage.getItem(AI_TOKEN_STORAGE_KEY) || '';
    if (!dreamSession.dreamText) {
      dreamSession.status = '请先写下梦境内容';
      renderDreamCheckin();
      document.getElementById('dream-text')?.focus();
      return;
    }
    if (!token) {
      dreamSession.status = '请先输入 Bloom 测试密码';
      renderDreamCheckin();
      document.getElementById('dream-access-token')?.focus();
      return;
    }
    if (tokenInput) localStorage.setItem(AI_TOKEN_STORAGE_KEY, token);
    dreamSession.loading = true;
    dreamSession.status = 'AI 正在阅读完整梦境…';
    renderDreamCheckin();
    try {
      const response = await fetch(`${AI_ENDPOINT}/api/dream/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Bloom-Access-Token': token },
        body: JSON.stringify({ model: dreamSession.model, dreamText: dreamSession.dreamText }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('梦境解读接口尚未部署，请更新阿里云函数代码');
      }
      if (response.status === 401) {
        localStorage.removeItem(AI_TOKEN_STORAGE_KEY);
        throw new Error('测试密码无效或已失效，请重新输入当前测试密码');
      }
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      dreamSession.interpretation = String(payload.interpretation || '').trim();
      dreamSession.status = '已生成解读初稿，你可以继续修改';
    } catch (error) {
      dreamSession.status = `解读失败：${error.message}`;
    } finally {
      dreamSession.loading = false;
      renderDreamCheckin();
    }
  };

  const saveDreamRecord = (habit) => {
    dreamSession.dreamText = document.getElementById('dream-text')?.value.trim() || dreamSession.dreamText.trim();
    dreamSession.interpretation = document.getElementById('dream-interpretation')?.value.trim() || dreamSession.interpretation.trim();
    if (!dreamSession.dreamText) {
      dreamSession.status = '请先写下梦境内容';
      renderDreamCheckin();
      document.getElementById('dream-text')?.focus();
      return;
    }
    const recordId = dreamSession.recordId || `dream-${Date.now()}`;
    const wasComplete = habit.complete;
    habit.recorded = true;
    habit.complete = true;
    if (!wasComplete) habit.weekDone = Math.min(habit.weekTarget, habit.weekDone + 1);
    habit.weekStates[todayWeekIndex()] = 'complete';
    const existingRecordIndex = state.records.findIndex((record) => record.id === recordId);
    const existingRecord = existingRecordIndex >= 0 ? state.records[existingRecordIndex] : null;
    const dreamRecord = {
      id: recordId,
      type: 'dream',
      habitId: habit.id,
      title: fallbackDreamTitle(dreamSession.dreamText),
      summary: dreamSession.interpretation,
      sourceText: dreamSession.dreamText,
      images: existingRecord?.images || [],
      imageIds: existingRecord?.imageIds || [],
      metrics: {},
      createdAt: selectedRecordTimestamp(),
    };
    if (existingRecordIndex >= 0) {
      dreamRecord.createdAt = state.records[existingRecordIndex].createdAt;
      state.records.splice(existingRecordIndex, 1, dreamRecord);
    } else {
      state.records.unshift(dreamRecord);
    }
    recordTodayInHistory(habit, {
      dreamText: dreamSession.dreamText,
      interpretation: dreamSession.interpretation,
      recordId,
    });
    persist();
    closeLayers();
    renderAll();
    showToast('梦境已保存，可在“记录”中查看');
  };

  const openCheckin = (habitId) => {
    const habit = state.habits.find((item) => item.id === habitId);
    const todayEntry = state.history?.[selectedDateKey()]?.[habitId];
    activeHabitId = habitId;
    elements.fields.onclick = null;
    elements.fields.onchange = null;
    const formSaveButton = document.querySelector('#checkin-form > .save-button');
    formSaveButton.hidden = false;
    formSaveButton.textContent = t().saveRecord;
    pendingWorkoutSession = null;
    dreamSession = null;
    selectedCheckinImageDataUrl = '';
    aiRecognitionResults = new Map();
    const isCurrentDate = selectedDateKey() === localDateKey(new Date());
    const checkinDateLabel = new Intl.DateTimeFormat(state.language === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'numeric', day: 'numeric',
    }).format(selectedTodayDate);
    document.getElementById('sheet-title').textContent = isCurrentDate
      ? habitName(habit)
      : `${habitName(habit)} · ${checkinDateLabel}`;
    elements.result.textContent = '';

    if (habit.kind === 'boolean' && !hasOptionalContent(habit)) {
      habit.recorded = !habit.recorded;
      habit.complete = habit.recorded;
      habit.weekDone += habit.recorded ? 1 : -1;
      habit.weekStates[todayWeekIndex()] = habit.recorded ? 'complete' : 'none';
      recordTodayInHistory(habit);
      persist();
      renderAll();
      showToast(habit.recorded ? t().completedToday : t().tapToComplete);
      return;
    }

    if (habit.kind === 'time') {
      elements.fields.innerHTML = `
        ${field(t().timeLabel, `<input id="checkin-time" type="time" value="${todayEntry?.value || ''}" required>`)}
        <p class="plan-note">${t().plannedTime(habit.target)}</p>
        ${optionalCheckinFields(habit)}
      `;
    } else if (habit.kind === 'workout') {
      const activityOptions = t().activityOptions;
      const savedActivity = todayEntry?.activityType || activityOptions[0];
      const isOtherActivity = !activityOptions.slice(0, -1).includes(savedActivity);
      elements.fields.innerHTML = `
        <div class="field-pair">
          ${field(t().minutes, `<input id="workout-minutes" type="number" min="1" value="${todayEntry?.minutes || ''}" required>`)}
          ${field(t().activity, `<select id="activity-type">${activityOptions.map((option, index) => {
            const selected = isOtherActivity ? index === activityOptions.length - 1 : option === savedActivity;
            return `<option value="${option}" ${selected ? 'selected' : ''}>${option}</option>`;
          }).join('')}</select>`)}
        </div>
        <div id="other-activity-field" ${isOtherActivity ? '' : 'hidden'}>
          ${field(t().otherActivity, `<input id="other-activity" type="text" maxlength="24" value="${isOtherActivity ? escapeHtml(savedActivity) : ''}" placeholder="${t().otherActivityPlaceholder}">`)}
        </div>
        ${optionalCheckinFields(habit)}
      `;
    } else if (habit.kind === 'reading') {
      readingSession = {
        step: 'choice',
        images: [],
        ocrByImage: new Map(),
        activeSourceId: '',
        mergedSource: '',
        confirmedSource: '',
        reflection: '',
        title: '',
        titleStatus: '',
        titleLoading: false,
        titleRequested: false,
        minutes: todayEntry?.minutes ?? '',
        pages: todayEntry?.pages ?? '',
        model: state.defaultAiModel,
        loading: false,
        status: '',
      };
      openLayer(elements.sheet);
      setupReadingFlow();
      return;
    } else if (habit.kind === 'dream') {
      dreamSession = {
        dreamText: todayEntry?.dreamText || '',
        interpretation: todayEntry?.interpretation || '',
        recordId: todayEntry?.recordId || '',
        model: state.defaultAiModel,
        loading: false,
        status: '',
      };
      openLayer(elements.sheet);
      renderDreamCheckin();
      return;
    } else if (habit.kind === 'weight') {
      elements.fields.innerHTML = `${field(t().weight, `<input id="weight-value" type="number" min="1" step="0.1" value="${Number.isFinite(todayEntry?.value) ? todayEntry.value : ''}" required>`)}${optionalCheckinFields(habit)}`;
    } else if (habit.kind === 'boolean') {
      elements.fields.innerHTML = optionalCheckinFields(habit);
    } else if (habit.kind === 'custom') {
      if (!habit.quantified && !hasOptionalContent(habit)) {
        habit.recorded = !habit.recorded;
        habit.complete = habit.recorded;
        habit.weekDone += habit.recorded ? 1 : -1;
        habit.weekStates[todayWeekIndex()] = habit.recorded ? 'complete' : 'none';
        recordTodayInHistory(habit);
        persist();
        renderAll();
        showToast(habit.recorded ? t().completedToday : t().tapToComplete);
        return;
      }
      if (habit.quantified) {
        const type = habit.metricType === 'time' ? 'time' : 'number';
        const unitLabel = habit.unit
          ? `<span class="value-input-unit">${habit.unit}</span>`
          : '';
        elements.fields.innerHTML = `${field(t().enterValue, `
          <div class="value-input-row">
            <input id="custom-value" type="${type}" min="0" inputmode="${type === 'number' ? 'decimal' : 'text'}" value="${todayEntry?.value ?? ''}" required>
            ${unitLabel}
          </div>
        `)}${optionalCheckinFields(habit)}`;
      } else {
        elements.fields.innerHTML = optionalCheckinFields(habit);
      }
    }
    openLayer(elements.sheet);
    setupOptionalInputs(habit);
    if (habit.kind === 'workout') {
      const activitySelect = document.getElementById('activity-type');
      const otherField = document.getElementById('other-activity-field');
      const updateOtherActivity = (shouldFocus = false) => {
        const isOther = activitySelect.value === t().activityOptions[t().activityOptions.length - 1];
        otherField.hidden = !isOther;
        document.getElementById('other-activity').required = isOther;
        if (isOther && shouldFocus) document.getElementById('other-activity').focus();
      };
      activitySelect.addEventListener('change', () => updateOtherActivity(true));
      updateOtherActivity();
    }
  };

  const renderWorkoutTitleConfirmation = (habit) => {
    const session = pendingWorkoutSession;
    document.getElementById('sheet-title').textContent = habitName(habit);
    elements.fields.innerHTML = `
      <div class="workout-record-preview">
        <section class="record-title-panel">
          <div class="reading-section-head">
            <div><strong>记录标题</strong><small>保存前确认；可以自己写，也可以让 AI 建议</small></div>
          </div>
          <div class="record-title-row">
            <input id="workout-record-title" maxlength="28" value="${escapeHtml(session.title)}" aria-label="记录标题">
            <button id="workout-ai-title" type="button" ${session.titleLoading ? 'disabled' : ''}>${session.titleLoading ? '生成中…' : 'AI 生成标题'}</button>
          </div>
          <p class="reading-helper">${escapeHtml(session.titleStatus || '最终以你确认或修改后的标题保存。')}</p>
        </section>
        <section class="reading-panel">
          <div class="reading-section-head">
            <div><strong>运动记录预览</strong><small>${escapeHtml(session.activityType)} · ${session.minutes} 分钟</small></div>
            <span>未保存</span>
          </div>
          ${session.image ? `<div class="record-detail-images"><button type="button" id="workout-preview-image"><img src="${escapeHtml(session.image)}" alt="运动记录图片"></button></div>` : ''}
          <div class="reading-record-section">
            <strong>身体感受/训练内容</strong>
            <p>${escapeHtml(session.note || '尚未填写文字')}</p>
          </div>
        </section>
      </div>
    `;
    const saveButton = document.querySelector('#checkin-form > .save-button');
    saveButton.textContent = '确认标题并保存';
    document.getElementById('workout-record-title').addEventListener('input', (event) => {
      session.title = event.target.value;
    });
    document.getElementById('workout-ai-title').addEventListener('click', async () => {
      session.title = document.getElementById('workout-record-title').value.trim();
      session.titleLoading = true;
      session.titleStatus = 'AI 正在生成标题建议…';
      renderWorkoutTitleConfirmation(habit);
      try {
        const title = await requestRecordTitle({
          type: 'workout',
          sourceText: session.activityType,
          reflection: session.note,
          metrics: `${session.activityType}，${session.minutes} 分钟`,
          model: state.defaultAiModel,
        });
        if (title) session.title = title;
        session.titleStatus = '已生成标题，你仍可以修改';
      } catch {
        session.titleStatus = 'AI 暂时不可用，已保留可编辑标题，不影响保存';
      } finally {
        session.titleLoading = false;
        renderWorkoutTitleConfirmation(habit);
      }
    });
    document.getElementById('workout-preview-image')?.addEventListener('click', () => showRecordLightbox(session.image));
  };

  const commitWorkoutCheckin = async (habit) => {
    const session = pendingWorkoutSession;
    session.title = document.getElementById('workout-record-title')?.value.trim() || session.title;
    session.title = session.title || fallbackRecordTitle('workout', session.activityType, session.note, session.activityType);
    const wasComplete = habit.complete;
    const previousRecords = [...state.records];
    const todayKey = selectedDateKey();
    const previousTodayHistory = state.history?.[todayKey]?.[habit.id]
      ? { ...state.history[todayKey][habit.id] }
      : null;
    const previousHabit = {
      minutes: habit.minutes,
      actual: habit.actual,
      recorded: habit.recorded,
      complete: habit.complete,
      weekDone: habit.weekDone,
      weekState: habit.weekStates[todayWeekIndex()],
      note: habit.note,
    };
    const recordId = `workout-${Date.now()}`;
    const storedMedia = await persistRecordImages(
      recordId,
      'workout',
      session.image ? [session.image] : [],
    );
    habit.minutes += session.minutes;
    habit.actual += habit.recorded ? 0 : 1;
    habit.recorded = true;
    habit.complete = session.minutes >= 30;
    habit.note = session.note;
    if (!wasComplete && habit.complete) habit.weekDone = Math.min(habit.weekTarget, habit.weekDone + 1);
    if (wasComplete && !habit.complete) habit.weekDone = Math.max(0, habit.weekDone - 1);
    habit.weekStates[todayWeekIndex()] = habit.complete ? 'complete' : 'recorded';
    recordTodayInHistory(habit, { minutes: session.minutes, activityType: session.activityType });
    state.records.unshift({
      id: recordId,
      type: 'workout',
      habitId: habit.id,
      title: session.title,
      content: session.note,
      images: storedMedia.images,
      imageIds: storedMedia.imageIds,
      metrics: { minutes: session.minutes, activityType: session.activityType },
      createdAt: selectedRecordTimestamp(),
    });
    try {
      persist();
    } catch {
      Object.assign(habit, {
        minutes: previousHabit.minutes,
        actual: previousHabit.actual,
        recorded: previousHabit.recorded,
        complete: previousHabit.complete,
        weekDone: previousHabit.weekDone,
        note: previousHabit.note,
      });
      habit.weekStates[todayWeekIndex()] = previousHabit.weekState;
      state.records = previousRecords;
      if (previousTodayHistory) state.history[todayKey][habit.id] = previousTodayHistory;
      else delete state.history?.[todayKey]?.[habit.id];
      elements.result.textContent = '当前设备存储空间不足，请减少图片后重试';
      return;
    }
    closeLayers();
    renderAll();
    showToast('保存成功，可在“记录”中查看');
  };

  const selectedWorkoutActivity = () => {
    const selected = document.getElementById('activity-type')?.value || '';
    const otherOption = t().activityOptions[t().activityOptions.length - 1];
    return selected === otherOption
      ? document.getElementById('other-activity')?.value.trim() || otherOption
      : selected;
  };

  const saveCheckin = async () => {
    const habit = state.habits.find((item) => item.id === activeHabitId);
    if (!habit) return;
    if (habit.kind === 'dream' && dreamSession) {
      saveDreamRecord(habit);
      return;
    }
    if (habit?.kind === 'workout' && pendingWorkoutSession) {
      await commitWorkoutCheckin(habit);
      return;
    }
    const wasComplete = habit.complete;
    let historyDetails = {};

    if (habit.kind === 'time') {
      habit.actual = document.getElementById('checkin-time').value;
      habit.recorded = true;
      habit.complete = habit.id === 'sleep' ? habit.actual <= habit.target : habit.actual <= habit.target;
    } else if (habit.kind === 'workout') {
      const minutes = Number(document.getElementById('workout-minutes').value);
      const activityType = selectedWorkoutActivity();
      const note = document.getElementById('record-note')?.value.trim() || '';
      if (note || selectedCheckinImageDataUrl) {
        pendingWorkoutSession = {
          minutes,
          activityType,
          note,
          image: selectedCheckinImageDataUrl,
          title: fallbackRecordTitle('workout', activityType, note, activityType),
          titleStatus: '',
          titleLoading: false,
        };
        renderWorkoutTitleConfirmation(habit);
        return;
      }
      habit.minutes += minutes;
      habit.actual += habit.recorded ? 0 : 1;
      habit.recorded = true;
      habit.complete = minutes >= 30;
    } else if (habit.kind === 'reading') {
      habit.minutes = Number(document.getElementById('reading-minutes').value);
      habit.pages = Number(document.getElementById('reading-pages').value);
      habit.recorded = true;
      habit.complete = habit.minutes >= habit.target;
    } else if (habit.kind === 'weight') {
      habit.value = Number(document.getElementById('weight-value').value);
      habit.recorded = true;
      habit.complete = true;
    } else if (habit.kind === 'boolean') {
      habit.recorded = true;
      habit.complete = true;
    } else if (habit.kind === 'custom') {
      if (habit.quantified) {
        const raw = document.getElementById('custom-value').value;
        habit.value = habit.metricType === 'time' ? raw : Number(raw);
        habit.complete = habit.metricType === 'time' ? true : habit.value >= habit.target;
      } else {
        habit.complete = true;
      }
      habit.recorded = true;
    }
    const note = document.getElementById('record-note');
    if (note) habit.note = note.value.trim();

    if (!wasComplete && habit.complete) habit.weekDone = Math.min(habit.weekTarget, habit.weekDone + 1);
    if (wasComplete && !habit.complete) habit.weekDone = Math.max(0, habit.weekDone - 1);
    habit.weekStates[todayWeekIndex()] = habit.complete ? 'complete' : habit.recorded ? 'recorded' : 'none';
    recordTodayInHistory(habit, habit.kind === 'workout'
      ? {
        minutes: Number(document.getElementById('workout-minutes')?.value) || 0,
        activityType: selectedWorkoutActivity(),
      }
      : historyDetails);
    persist();
    closeLayers();
    renderAll();
    showToast(t().saved);
  };

  const showToast = (message) => {
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 1800);
  };

  const reorderHabits = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = state.habits.findIndex((habit) => habit.id === sourceId);
    const targetIndex = state.habits.findIndex((habit) => habit.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = state.habits.splice(sourceIndex, 1);
    const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    state.habits.splice(adjustedTarget, 0, moved);
    persist();
    renderAll();
    showToast(state.language === 'zh' ? '顺序已更新' : 'Order updated');
  };

  const clearDragStyles = () => {
    elements.managedHabitList.querySelectorAll('.managed-habit').forEach((card) => {
      card.classList.remove('is-dragging', 'is-drag-over');
    });
  };

  const renderWeekdayChoices = () => {
    const selected = new Set([...document.querySelectorAll('.weekday-choice.is-selected')].map((button) => button.dataset.day));
    document.getElementById('weekday-options').innerHTML = weekdayKeys.map((day, index) => `
      <button class="weekday-choice ${selected.has(day) || (!selected.size && index < 5) ? 'is-selected' : ''}" type="button" data-day="${day}" aria-pressed="${selected.has(day) || (!selected.size && index < 5)}">${t()[day]}</button>
    `).join('');
  };

  const renderFallbackIcons = () => {
    document.getElementById('letter-icon-options').innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `
      <button class="icon-choice fallback-choice" type="button" data-icon="letter-${letter}" aria-label="字母 ${letter}" aria-pressed="false">${iconMarkup(`letter-${letter}`)}</button>
    `).join('');
    document.getElementById('color-icon-options').innerHTML = fallbackColors.map((_, index) => `
      <button class="icon-choice fallback-choice" type="button" data-icon="color-${index}" aria-label="颜色 ${index + 1}" aria-pressed="false">${iconMarkup(`color-${index}`)}</button>
    `).join('');
  };

  const setFrequency = (frequency) => {
    selectedFrequency = frequency;
    document.querySelectorAll('.frequency-choice').forEach((button) => {
      const selected = button.dataset.frequency === frequency;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.getElementById('weekdays-detail').hidden = frequency !== 'weekdays';
    document.getElementById('weekly-detail').hidden = frequency !== 'weekly';
    document.getElementById('interval-detail').hidden = frequency !== 'interval';
  };

  const resetHabitForm = () => {
    document.getElementById('habit-form').reset();
    selectedIcon = 'sprout';
    document.querySelectorAll('.icon-choice').forEach((button) => {
      const selected = button.dataset.icon === selectedIcon;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.getElementById('quantify-fields').hidden = true;
    document.getElementById('editing-habit-id').value = '';
    document.getElementById('habit-sheet-title').textContent = t().whatToKeep;
    document.getElementById('save-habit-button').textContent = t().createHabit;
    document.getElementById('fallback-icon-panel').hidden = true;
    document.getElementById('icon-more-button').setAttribute('aria-expanded', 'false');
    setFrequency('daily');
  };

  const metricSettingsForHabit = (habit) => {
    if (habit.kind === 'time') return { metricType: 'time', target: habit.target, unit: '' };
    if (habit.kind === 'workout') return { metricType: 'duration', target: habit.minuteTarget, unit: '分钟' };
    if (habit.kind === 'reading') return { metricType: 'duration', target: habit.target, unit: '分钟' };
    if (habit.kind === 'weight') return { metricType: 'number', target: 1, unit: '' };
    return { metricType: habit.metricType || 'duration', target: habit.target || 30, unit: habit.unit || '' };
  };

  const configureMetricInput = (metricType) => {
    const targetInput = document.getElementById('habit-target');
    const fieldPair = targetInput.closest('.field-pair');
    const unitField = document.getElementById('habit-unit-field');
    targetInput.type = metricType === 'time' ? 'time' : 'number';
    targetInput.min = metricType === 'time' ? '' : '1';
    if (metricType === 'time' && !String(targetInput.value).includes(':')) targetInput.value = '23:30';
    unitField.hidden = metricType === 'time';
    fieldPair.classList.toggle('is-single-field', metricType === 'time');
  };

  const openHabitEditor = (habitId) => {
    const habit = state.habits.find((item) => item.id === habitId);
    if (!habit) return;
    resetHabitForm();
    document.getElementById('editing-habit-id').value = habit.id;
    document.getElementById('habit-sheet-title').textContent = t().editHabit;
    document.getElementById('save-habit-button').textContent = t().saveChanges;
    document.getElementById('habit-name').value = habitName(habit);
    selectedIcon = iconKey(habit.icon);
    document.querySelectorAll('.icon-choice[data-icon]').forEach((button) => {
      const selected = button.dataset.icon === selectedIcon;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const quantified = habit.kind !== 'boolean' || Boolean(habit.quantified);
    document.getElementById('quantify-toggle').checked = quantified;
    document.getElementById('quantify-fields').hidden = !quantified;
    const metric = metricSettingsForHabit(habit);
    document.getElementById('metric-type').value = metric.metricType;
    configureMetricInput(metric.metricType);
    document.getElementById('habit-target').value = metric.target;
    document.getElementById('habit-unit').value = ['分钟', '次', ''].includes(metric.unit) ? metric.unit : '';
    document.getElementById('notes-toggle').checked = hasOptionalContent(habit);
    setFrequency(habit.frequency.type);
    if (habit.frequency.type === 'weekly') document.getElementById('weekly-count').value = habit.frequency.count;
    if (habit.frequency.type === 'interval') document.getElementById('interval-days').value = habit.frequency.days;
    if (habit.frequency.type === 'weekdays') {
      const days = new Set(habit.frequency.days);
      document.querySelectorAll('.weekday-choice').forEach((button) => {
        const selected = days.has(button.dataset.day);
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    }
    openLayer(elements.habitSheet);
  };

  const saveHabit = () => {
    const name = document.getElementById('habit-name').value.trim();
    const translation = resolveHabitTranslation(name);
    const sourceLanguage = /[\u3400-\u9fff]/.test(name) ? 'zh' : 'en';
    const quantified = document.getElementById('quantify-toggle').checked;
    const metricType = document.getElementById('metric-type').value;
    const targetRaw = document.getElementById('habit-target').value;
    const target = metricType === 'time' ? targetRaw : Number(targetRaw) || 1;
    const unit = document.getElementById('habit-unit').value.trim();
    let frequency = { type: 'daily' };
    let weekTarget = 7;
    if (selectedFrequency === 'weekly') {
      const count = Number(document.getElementById('weekly-count').value) || 1;
      frequency = { type: 'weekly', count };
      weekTarget = count;
    } else if (selectedFrequency === 'weekdays') {
      const days = [...document.querySelectorAll('.weekday-choice.is-selected')].map((button) => button.dataset.day);
      frequency = { type: 'weekdays', days };
      weekTarget = days.length;
    } else if (selectedFrequency === 'interval') {
      const days = Number(document.getElementById('interval-days').value) || 2;
      frequency = { type: 'interval', days };
      weekTarget = Math.max(1, Math.round(7 / days));
    }
    const notesEnabled = document.getElementById('notes-toggle').checked;
    const recordOptions = { text: notesEnabled, photo: notesEnabled, voice: notesEnabled };
    const editingId = document.getElementById('editing-habit-id').value;
    const existing = state.habits.find((habit) => habit.id === editingId);
    if (existing) {
      existing.name = name;
      existing.sourceName = name;
      existing.sourceLanguage = sourceLanguage;
      existing.habitKey = translation?.key || existing.habitKey || existing.id;
      existing.nameZh = translation?.zh || (sourceLanguage === 'zh' ? name : '');
      existing.nameEn = translation?.en || (sourceLanguage === 'en' ? name : '');
      existing.icon = selectedIcon;
      existing.frequency = frequency;
      existing.weekTarget = weekTarget;
      existing.recordOptions = recordOptions;
      if (existing.kind === 'time' && metricType === 'time') existing.target = target;
      else if (existing.kind === 'workout' && metricType === 'duration') existing.minuteTarget = Number(target);
      else if (existing.kind === 'reading' && metricType === 'duration') existing.target = Number(target);
      else if (existing.kind === 'custom') Object.assign(existing, { quantified, metricType, target, unit });
      if (existing.kind === 'time') {
        existing.weekStates = currentWeekDateKeys().map((date) => historyStatus(date, existing.id));
        existing.weekDone = existing.weekStates.filter((status) => status === 'complete').length;
      }
      showToast(t().habitUpdated);
    } else {
      const id = `custom-${Date.now()}`;
      state.habits.push({
        id, name, sourceName: name, sourceLanguage, habitKey: translation?.key || id,
        nameZh: translation?.zh || (sourceLanguage === 'zh' ? name : ''),
        nameEn: translation?.en || (sourceLanguage === 'en' ? name : ''),
        icon: selectedIcon, kind: 'custom', quantified, metricType, target, unit,
        value: 0, recorded: false, complete: false, weekDone: 0, weekTarget, frequency, recordOptions,
        weekStates: ['none', 'none', 'none', 'none', 'none', 'none', 'none'],
      });
      showToast(t().habitCreated);
    }
    persist();
    closeLayers();
    renderAll();
  };

  document.querySelectorAll('.nav-button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-button').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll('.page').forEach((page) => page.classList.toggle('is-active', page.id === button.dataset.page));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.getElementById('record-filters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-record-filter]');
    if (!button) return;
    recordFilter = button.dataset.recordFilter;
    renderRecords();
  });

  elements.modelSettingsList.addEventListener('click', (event) => {
    const option = event.target.closest('[data-default-ai-model]');
    if (!option) return;
    state.defaultAiModel = option.dataset.defaultAiModel;
    persist();
    renderModelSettings();
    showToast(state.language === 'zh' ? '默认模型已更新' : 'Default model updated');
  });

  elements.recordSections.addEventListener('click', (event) => {
    const entry = event.target.closest('[data-record-id]');
    if (entry) openRecordDetail(entry.dataset.recordId);
  });

  elements.habitList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-checkin]');
    if (button) openCheckin(button.dataset.checkin);
  });

  document.getElementById('checkin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveCheckin();
  });
  document.getElementById('close-sheet').addEventListener('click', closeLayers);
  document.getElementById('close-habit-sheet').addEventListener('click', closeLayers);
  elements.scrim.addEventListener('click', closeLayers);

  document.getElementById('language-button').addEventListener('click', () => {
    state.language = state.language === 'zh' ? 'en' : 'zh';
    persist();
    renderAll();
  });

  document.getElementById('previous-today-date').addEventListener('click', () => {
    const previousDate = new Date(selectedTodayDate);
    previousDate.setDate(previousDate.getDate() - 1);
    selectTodayDate(previousDate);
  });

  document.getElementById('next-today-date').addEventListener('click', () => {
    const nextDate = new Date(selectedTodayDate);
    nextDate.setDate(nextDate.getDate() + 1);
    selectTodayDate(nextDate);
  });

  document.getElementById('today-date-input').addEventListener('change', (event) => {
    if (event.target.value) selectTodayDate(dateFromKey(event.target.value));
  });

  document.getElementById('add-habit-button').addEventListener('click', () => {
    resetHabitForm();
    openLayer(elements.habitSheet);
  });

  document.getElementById('quantify-toggle').addEventListener('change', (event) => {
    document.getElementById('quantify-fields').hidden = !event.target.checked;
  });

  document.getElementById('icon-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-icon]');
    if (!button) return;
    selectedIcon = button.dataset.icon;
    document.querySelectorAll('.icon-choice').forEach((choice) => {
      const selected = choice === button;
      choice.classList.toggle('is-selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
  });

  document.getElementById('fallback-icon-panel').addEventListener('click', (event) => {
    const button = event.target.closest('[data-icon]');
    if (!button) return;
    selectedIcon = button.dataset.icon;
    document.querySelectorAll('.icon-choice[data-icon]').forEach((choice) => {
      const selected = choice.dataset.icon === selectedIcon;
      choice.classList.toggle('is-selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
  });

  document.getElementById('icon-more-button').addEventListener('click', () => {
    const panel = document.getElementById('fallback-icon-panel');
    panel.hidden = !panel.hidden;
    document.getElementById('icon-more-button').setAttribute('aria-expanded', String(!panel.hidden));
  });

  document.getElementById('frequency-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-frequency]');
    if (button) setFrequency(button.dataset.frequency);
  });

  document.getElementById('weekday-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-day]');
    if (!button) return;
    button.classList.toggle('is-selected');
    button.setAttribute('aria-pressed', String(button.classList.contains('is-selected')));
  });

  document.getElementById('habit-form').addEventListener('submit', (event) => {
    event.preventDefault();
    saveHabit();
  });

  document.getElementById('metric-type').addEventListener('change', (event) => {
    configureMetricInput(event.target.value);
  });

  elements.managedHabitList.addEventListener('click', (event) => {
    const menuButton = event.target.closest('[data-habit-menu]');
    if (menuButton) {
      pendingDeleteHabitId = null;
      const menu = elements.managedHabitList.querySelector(`[data-menu-for="${menuButton.dataset.habitMenu}"]`);
      elements.managedHabitList.querySelectorAll('.habit-action-menu').forEach((item) => {
        if (item !== menu) {
          item.hidden = true;
          item.closest('.managed-habit')?.classList.remove('has-open-menu');
        }
      });
      const shouldOpen = menu.hidden;
      menu.hidden = !shouldOpen;
      const card = menuButton.closest('.managed-habit');
      card?.classList.toggle('has-open-menu', shouldOpen);
      if (shouldOpen) {
        const availableBelow = window.innerHeight - menuButton.getBoundingClientRect().bottom - 16;
        menu.classList.toggle('opens-upward', availableBelow < menu.offsetHeight);
      }
      return;
    }
    const editButton = event.target.closest('[data-edit-habit]');
    if (editButton) {
      openHabitEditor(editButton.dataset.editHabit);
      return;
    }
    const hideButton = event.target.closest('[data-toggle-hidden]');
    if (hideButton) {
      const habit = state.habits.find((item) => item.id === hideButton.dataset.toggleHidden);
      if (!habit) return;
      habit.hidden = !habit.hidden;
      persist();
      renderAll();
      showToast(habit.hidden ? '已从今天隐藏' : '已恢复到今天');
      return;
    }
    const deleteButton = event.target.closest('[data-delete-habit]');
    if (deleteButton) {
      const habit = state.habits.find((item) => item.id === deleteButton.dataset.deleteHabit);
      if (!habit) return;
      if (pendingDeleteHabitId !== habit.id) {
        pendingDeleteHabitId = habit.id;
        deleteButton.textContent = state.language === 'zh' ? '再次点击确认删除' : 'Click again to delete';
        deleteButton.classList.add('is-confirming');
        return;
      }
      pendingDeleteHabitId = null;
      state.habits = state.habits.filter((item) => item.id !== habit.id);
      persist();
      renderAll();
      showToast('习惯已删除');
    }
  });

  let pointerDragState = null;
  const animateHabitShift = (beforeRects) => {
    requestAnimationFrame(() => {
      elements.managedHabitList.querySelectorAll('.managed-habit:not(.is-pointer-dragging)').forEach((card) => {
        const before = beforeRects.get(card.dataset.managedHabit);
        if (!before) return;
        const deltaY = before.top - card.getBoundingClientRect().top;
        if (Math.abs(deltaY) < 1 || !card.animate) return;
        card.animate(
          [{ transform: `translateY(${deltaY}px)` }, { transform: 'translateY(0)' }],
          { duration: 190, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
      });
    });
  };

  const finishPointerHabitDrag = (saveOrder) => {
    if (!pointerDragState) return;
    const { card, placeholder } = pointerDragState;
    card.classList.remove('is-pointer-dragging');
    card.removeAttribute('style');
    if (saveOrder) {
      placeholder.replaceWith(card);
      const order = [...elements.managedHabitList.querySelectorAll('[data-managed-habit]')]
        .map((item) => item.dataset.managedHabit);
      const habitsById = new Map(state.habits.map((habit) => [habit.id, habit]));
      state.habits = order.map((id) => habitsById.get(id)).filter(Boolean);
      persist();
      renderAll();
      showToast(state.language === 'zh' ? '顺序已更新' : 'Order updated');
    } else {
      renderManagedHabits();
    }
    draggedHabitId = null;
    pointerDragState = null;
  };

  elements.managedHabitList.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('[data-drag-handle]');
    if (!handle || pointerDragState || event.button !== 0) return;
    event.preventDefault();
    const card = handle.closest('.managed-habit');
    const rect = card.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.className = 'managed-habit-placeholder';
    placeholder.style.height = `${rect.height}px`;
    card.before(placeholder);
    draggedHabitId = handle.dataset.dragHandle;
    handle.setPointerCapture(event.pointerId);
    card.classList.add('is-pointer-dragging');
    Object.assign(card.style, {
      position: 'fixed',
      zIndex: '40',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      margin: '0',
    });
    pointerDragState = {
      card,
      placeholder,
      pointerId: event.pointerId,
      grabOffsetY: event.clientY - rect.top,
    };
  });

  elements.managedHabitList.addEventListener('pointermove', (event) => {
    if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;
    event.preventDefault();
    const { card, placeholder, grabOffsetY } = pointerDragState;
    card.style.top = `${event.clientY - grabOffsetY}px`;
    const candidates = [...elements.managedHabitList.querySelectorAll('.managed-habit:not(.is-pointer-dragging)')];
    const beforeRects = new Map(candidates.map((item) => [item.dataset.managedHabit, item.getBoundingClientRect()]));
    const nextCard = candidates.find((item) => event.clientY < item.getBoundingClientRect().top + item.offsetHeight / 2);
    const currentNext = placeholder.nextElementSibling === card
      ? card.nextElementSibling
      : placeholder.nextElementSibling;
    if (nextCard !== currentNext) {
      if (nextCard) elements.managedHabitList.insertBefore(placeholder, nextCard);
      else elements.managedHabitList.appendChild(placeholder);
      animateHabitShift(beforeRects);
    }
    if (event.clientY < 90) window.scrollBy({ top: -8, behavior: 'auto' });
    if (event.clientY > window.innerHeight - 90) window.scrollBy({ top: 8, behavior: 'auto' });
  });

  elements.managedHabitList.addEventListener('pointerup', (event) => {
    if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;
    finishPointerHabitDrag(true);
  });

  elements.managedHabitList.addEventListener('pointercancel', () => finishPointerHabitDrag(false));

  document.getElementById('period-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-period]');
    if (!button) return;
    reviewPeriod = button.dataset.period;
    reviewOffset = 0;
    renderReview();
  });

  document.getElementById('previous-period').addEventListener('click', () => {
    reviewOffset -= 1;
    renderReview();
  });

  document.getElementById('next-period').addEventListener('click', () => {
    reviewOffset += 1;
    renderReview();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLayers();
  });

  renderAll();
  hydrateAndMigrateRecordMedia().catch(() => {
    // Records remain usable with the localStorage fallback when IndexedDB is unavailable.
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=27').catch(() => {
        // Offline caching is optional; Bloom remains usable online.
      });
    });
  }
})();
