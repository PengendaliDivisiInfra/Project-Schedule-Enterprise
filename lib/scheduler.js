// ==========================================
// ENTERPRISE SCHEDULER ENGINE (PMBOK STANDARD)
// ==========================================

export function addWorkingDays(startStr, daysToAdd, workingDays, exceptions) {
  if (!startStr) return '';
  let currentDate = new Date(startStr);
  if (isNaN(currentDate.getTime())) return startStr;
  
  while (!workingDays.includes(currentDate.getDay()) || exceptions.some(e => e.exception_date === currentDate.toISOString().split('T')[0])) {
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  if (daysToAdd === 0) return currentDate.toISOString().split('T')[0];
  
  let added = 0;
  let direction = daysToAdd > 0 ? 1 : -1;
  let target = Math.abs(daysToAdd);

  while (added < target) {
    currentDate.setDate(currentDate.getDate() + direction);
    if (workingDays.includes(currentDate.getDay()) && !exceptions.some(e => e.exception_date === currentDate.toISOString().split('T')[0])) {
      added++;
    }
  }
  return currentDate.toISOString().split('T')[0];
}

export function countWorkingDays(startStr, endStr, workingDays, exceptions) {
  if (!startStr || !endStr) return 1;
  let count = 0; let cur = new Date(startStr); const end = new Date(endStr);
  while (cur <= end) {
    if (workingDays.includes(cur.getDay()) && !exceptions.some(e => e.exception_date === cur.toISOString().split('T')[0])) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

export function parsePredecessor(predStr) {
  if (!predStr) return null;
  const regex = /^([\d\.]+)(FS|SS|FF|SF)?([+-]\d+)?$/i;
  const match = predStr.replace(/\s+/g, '').match(regex);
  if (!match) return null;

  return {
    predWbs: match[1],
    type: match[2] ? match[2].toUpperCase() : 'FS',
    lag: match[3] ? parseInt(match[3], 10) : 0
  };
}

// DETEKSI LOOPING (CIRCULAR DEPENDENCY)
export function hasCircularDependency(tasks) {
  const adjList = new Map();
  
  tasks.forEach(task => {
    if (task.predecessors) {
      const parsed = parsePredecessor(task.predecessors);
      if (parsed) adjList.set(task.wbs_code, parsed.predWbs);
    }
  });

  const visited = new Set();
  const recStack = new Set();
  let cyclePath = [];

  function dfs(node, currentPath) {
    if (recStack.has(node)) {
      const startIndex = currentPath.indexOf(node);
      cyclePath = [...currentPath.slice(startIndex), node];
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    recStack.add(node);
    currentPath.push(node);

    const nextNode = adjList.get(node);
    if (nextNode) {
      if (dfs(nextNode, currentPath)) return true;
    }

    currentPath.pop();
    recStack.delete(node);
    return false;
  }

  for (const task of tasks) {
    if (!visited.has(task.wbs_code)) {
      if (dfs(task.wbs_code, [])) {
        return { hasLoop: true, cyclePath };
      }
    }
  }
  return { hasLoop: false, cyclePath: [] };
}

// FORWARD PASS & ROLLUP SECURE PIPELINE
export function updateProjectScheduleSecure(tasks, workingDays, exceptions) {
  // Langkah 1: Cek Sirkular
  const check = hasCircularDependency(tasks);
  if (check.hasLoop) {
    return { success: false, tasks: tasks, errorMessage: `Circular Dependency: ${check.cyclePath.join(' -> ')}` };
  }

  // Deep Clone
  let updatedTasks = JSON.parse(JSON.stringify(tasks));
  
  // Langkah 2: Cascading Loop (Maksimal 20 iterasi)
  for (let loop = 0; loop < 20; loop++) {
    let changed = false;

    updatedTasks = updatedTasks.map(task => {
      if (task.summary === 'Yes' || !task.predecessors) return task;

      const parsed = parsePredecessor(task.predecessors);
      if (!parsed) return task;

      const predTask = updatedTasks.find(t => t.wbs_code === parsed.predWbs);
      if (!predTask) return task;

      let newStart = task.start_date;
      let newEnd = task.end_date;

      // 4 Matriks Logika Standar PMBOK
      if (parsed.type === 'FS' && predTask.end_date) {
        newStart = addWorkingDays(predTask.end_date, 1 + parsed.lag, workingDays, exceptions);
        newEnd = addWorkingDays(newStart, task.duration - 1, workingDays, exceptions);
      } else if (parsed.type === 'SS' && predTask.start_date) {
        newStart = addWorkingDays(predTask.start_date, parsed.lag, workingDays, exceptions);
        newEnd = addWorkingDays(newStart, task.duration - 1, workingDays, exceptions);
      } else if (parsed.type === 'FF' && predTask.end_date) {
        newEnd = addWorkingDays(predTask.end_date, parsed.lag, workingDays, exceptions);
        newStart = addWorkingDays(newEnd, -(task.duration - 1), workingDays, exceptions);
      } else if (parsed.type === 'SF' && predTask.start_date) {
        newEnd = addWorkingDays(predTask.start_date, parsed.lag, workingDays, exceptions);
        newStart = addWorkingDays(newEnd, -(task.duration - 1), workingDays, exceptions);
      }

      if (newStart !== task.start_date || newEnd !== task.end_date) {
        changed = true;
        return { ...task, start_date: newStart, end_date: newEnd };
      }
      return task;
    });

    if (!changed) break; 
  }

  // Langkah 3: Rollup Induk (Parent Task)
  const summaryTasks = updatedTasks.filter(t => t.summary === 'Yes').sort((a, b) => b.wbs_code.length - a.wbs_code.length);
  
  summaryTasks.forEach(summary => {
    const children = updatedTasks.filter(t => !t.summary && t.wbs_code.startsWith(summary.wbs_code + '.'));
    if (children.length === 0) return;

    const validChildren = children.filter(c => c.start_date && c.end_date);
    if (validChildren.length === 0) return;

    const startTimestamps = validChildren.map(c => new Date(c.start_date).getTime());
    const finishTimestamps = validChildren.map(c => new Date(c.end_date).getTime());

    const minStart = new Date(Math.min(...startTimestamps)).toISOString().split('T')[0];
    const maxFinish = new Date(Math.max(...finishTimestamps)).toISOString().split('T')[0];
    
    const idx = updatedTasks.findIndex(t => t.id === summary.id);
    if (idx !== -1) {
      updatedTasks[idx] = { 
        ...updatedTasks[idx], 
        start_date: minStart, 
        end_date: maxFinish,
        duration: countWorkingDays(minStart, maxFinish, workingDays, exceptions)
      };
    }
  });

  return { success: true, tasks: updatedTasks };
}
