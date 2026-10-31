// lib/cpmEngine.js

export const isWorkingDay = (date, workingDays = [1,2,3,4,5], exceptionsSet = new Set()) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
  const day = date.getDay();
  const dateStr = date.toISOString().split('T')[0];

  if (!workingDays || !workingDays.includes(day)) return false;
  if (exceptionsSet && exceptionsSet.has(dateStr)) return false;
  
  return true;
};

export const addWorkingDays = (startDateStr, durationInDays, workingDays = [1,2,3,4,5], exceptionsSet = new Set()) => {
  if (!startDateStr || durationInDays <= 0) return startDateStr || '';
  let date = new Date(startDateStr);
  if (isNaN(date.getTime())) return startDateStr;
  
  while (!isWorkingDay(date, workingDays, exceptionsSet)) {
    date.setDate(date.getDate() + 1);
  }
  
  let addedDays = 1;
  while (addedDays < durationInDays) {
    date.setDate(date.getDate() + 1);
    if (isWorkingDay(date, workingDays, exceptionsSet)) addedDays++;
  }
  return date.toISOString().split('T')[0];
};

export const getWorkingDaysDiff = (startStr, endStr, workingDays = [1,2,3,4,5], exceptionsSet = new Set()) => {
  if (!startStr || !endStr) return 0;
  let start = new Date(startStr); let end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (start > end) return 0;
  let count = 0; let cur = new Date(start);
  while (cur <= end) {
    if (isWorkingDay(cur, workingDays, exceptionsSet)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

export const parsePredecessors = (predStr) => {
  if (!predStr || typeof predStr !== 'string') return [];
  const regex = /([0-9.]+)\s*(FS|SS|FF|SF)?\s*([+-]\d+)?d?/gi;
  const matches = [...predStr.matchAll(regex)];
  return matches.map(m => ({
    wbs: m[1], type: (m[2] || 'FS').toUpperCase(), lag: m[3] ? parseInt(m[3]) : 0
  }));
};

export const validateCircularDependency = (flatArray) => {
  if (!flatArray || !Array.isArray(flatArray)) return { isValid: false, message: "Data task tidak valid" };
  const adjList = {}; const taskMapByWbs = {};
  flatArray.forEach(task => { 
    taskMapByWbs[task.wbs_code] = task.id; 
    adjList[task.id] = []; 
  });
  
  for (let task of flatArray) {
    if (task.predecessors && typeof task.predecessors === 'string') {
      const preds = parsePredecessors(task.predecessors);
      for (let p of preds) {
        const predId = taskMapByWbs[p.wbs];
        if (predId) adjList[predId].push(task.id);
      }
    }
  }
  const visited = {}; flatArray.forEach(task => visited[task.id] = 0);
  const pathTrack = [];
  function hasCycle(taskId) {
    visited[taskId] = 1;
    const foundTask = flatArray.find(t => t.id === taskId);
    pathTrack.push(foundTask ? `WBS ${foundTask.wbs_code}` : taskId);
    for (let neighborId of (adjList[taskId] || [])) {
      if (visited[neighborId] === 1) {
        pathTrack.push(flatArray.find(t => t.id === neighborId)?.wbs_code);
        return true; 
      }
      if (visited[neighborId] === 0 && hasCycle(neighborId)) return true;
    }
    visited[taskId] = 2; pathTrack.pop(); return false;
  }
  for (let task of flatArray) {
    if (visited[task.id] === 0 && hasCycle(task.id)) {
      return { isValid: false, message: `Circular Dependency: ${pathTrack.join(' -> ')}` };
    }
  }
  return { isValid: true, message: "Aman" };
};

export const convertFlatToTree = (flatArray) => {
  if (!flatArray || !Array.isArray(flatArray)) return [];
  const itemMap = {}; const roots = [];
  flatArray.forEach(item => {
    itemMap[item.id] = { 
      ...item, 
      start: item.start_date || new Date().toISOString().split('T')[0], 
      finish: item.end_date || new Date().toISOString().split('T')[0],
      cost: Number(item.cost || 0), 
      progress: Number(item.progress_percent || 0),
      duration: Number(item.duration || 0),
      isSummary: item.summary === 'Yes',
      children: [] 
    };
  });
  flatArray.forEach(item => {
    const mappedItem = itemMap[item.id];
    let parentId = item.parent_id;
    if (!parentId && mappedItem.wbs_code && mappedItem.wbs_code.includes('.')) {
      const wbsParts = mappedItem.wbs_code.split('.');
      wbsParts.pop();
      const parentWbs = wbsParts.join('.');
      const parentFound = flatArray.find(p => p.wbs_code === parentWbs);
      if (parentFound) parentId = parentFound.id;
    }
    if (parentId && itemMap[parentId]) {
      itemMap[parentId].children.push(mappedItem);
      itemMap[parentId].isSummary = true;
    } else {
      roots.push(mappedItem);
    }
  });
  const sortTree = (nodes) => {
    nodes.sort((a, b) => String(a.wbs_code).localeCompare(String(b.wbs_code), undefined, { numeric: true }));
    nodes.forEach(node => { if (node.children.length > 0) sortTree(node.children); });
  };
  sortTree(roots);
  return roots;
};

export const calculateWBSRollup = (node, workingDays, exceptionsSet) => {
  if (!node.children || node.children.length === 0) {
    node.isSummary = false; return node;
  }
  node.isSummary = true;
  node.children.forEach(child => calculateWBSRollup(child, workingDays, exceptionsSet));
  let minStart = new Date(node.children[0].start);
  let maxFinish = new Date(node.children[0].finish);
  let totalCost = 0; let totalWeightedProgress = 0; let totalChildrenDuration = 0;
  node.children.forEach(child => {
    const cStart = new Date(child.start);
    const cFinish = new Date(child.finish);
    if (cStart < minStart) minStart = cStart;
    if (cFinish > maxFinish) maxFinish = cFinish;
    totalCost += child.cost;
    totalWeightedProgress += (child.duration * child.progress);
    totalChildrenDuration += child.duration;
  });
  node.start = minStart.toISOString().split('T')[0];
  node.finish = maxFinish.toISOString().split('T')[0];
  node.cost = totalCost;
  node.duration = getWorkingDaysDiff(node.start, node.finish, workingDays, exceptionsSet);
  node.progress = totalChildrenDuration > 0 ? Math.round(totalWeightedProgress / totalChildrenDuration) : 0;
  return node;
};

export const convertTreeToFlat = (treeData) => {
  const flatResult = [];
  const nodes = Array.isArray(treeData) ? treeData : [treeData];
  function traverse(node) {
    flatResult.push({
      id: node.id, wbs_code: node.wbs_code, name: node.name,
      start_date: node.start, end_date: node.finish,
      duration: node.duration, progress_percent: node.progress,
      cost: node.cost, summary: node.isSummary ? 'Yes' : 'No',
      is_critical: node.is_critical, total_float: node.total_float,
      indent_level: node.indent_level, predecessors: node.predecessors
    });
    if (node.children) node.children.forEach(traverse);
  }
  nodes.forEach(traverse);
  return flatResult;
};

export const calculateCPM = (rawTasks, projectStartDate, workingDays = [1,2,3,4,5], exceptions = []) => {
  try {
    if (!rawTasks || rawTasks.length === 0) return { tasks: [], relations: [], error: null };
    
    const exceptionsSet = new Set(exceptions.map(e => e.exception_date));
    const validation = validateCircularDependency(rawTasks);
    if (!validation.isValid) return { error: validation.message, tasks: rawTasks, relations: [] };

    let taskTree = convertFlatToTree(rawTasks);
    const taskMap = {};
    const flattenForPass = (nodes) => {
      nodes.forEach(n => { taskMap[n.wbs_code] = n; flattenForPass(n.children); });
    };
    flattenForPass(taskTree);

    const forwardPass = (nodes) => {
      nodes.forEach(task => {
        forwardPass(task.children);
        if (task.isSummary) return;
        
        if (task.task_mode === 'Manually Scheduled') {
          task.ES_date = task.start_date || projectStartDate;
          task.EF_date = task.end_date || task.start_date;
          return;
        }
        
        let esDate = new Date(projectStartDate);
        if (isNaN(esDate.getTime())) esDate = new Date();
        
        const preds = parsePredecessors(task.predecessors);
        if (preds.length > 0) {
          let maxES = new Date(esDate);
          preds.forEach(p => {
            const predTask = taskMap[p.wbs];
            if (predTask && predTask.EF_date) {
              let p_ef = new Date(predTask.EF_date);
              let p_es = new Date(predTask.ES_date || predTask.EF_date);
              if (p.type === 'FS') {
                let potES = new Date(p_ef); potES.setDate(potES.getDate() + 1 + p.lag);
                if (potES > maxES) maxES = potES;
              } else if (p.type === 'SS') {
                let potES = new Date(p_es); potES.setDate(potES.getDate() + p.lag);
                if (potES > maxES) maxES = potES;
              }
            }
          });
          esDate = maxES;
        }
        while (!isWorkingDay(esDate, workingDays, exceptionsSet)) esDate.setDate(esDate.getDate() + 1);
        task.ES_date = esDate.toISOString().split('T')[0];
        task.EF_date = addWorkingDays(task.ES_date, task.duration, workingDays, exceptionsSet);
      });
    };
    forwardPass(taskTree);
    taskTree.forEach(root => calculateWBSRollup(root, workingDays, exceptionsSet));

    let projectFinishDate = new Date(projectStartDate);
    if (isNaN(projectFinishDate.getTime())) projectFinishDate = new Date();
    Object.values(taskMap).forEach(t => {
      if (t.EF_date) {
        let ef = new Date(t.EF_date);
        if (ef > projectFinishDate) projectFinishDate = ef;
      }
    });

    const backwardPass = (task) => {
      if (task.isSummary) return;
      let lfDate = new Date(projectFinishDate);
      let successors = Object.values(taskMap).filter(t => parsePredecessors(t.predecessors).some(p => p.wbs === task.wbs_code));
      if (successors.length > 0) {
        let minLF = new Date('2100-01-01');
        successors.forEach(succ => {
          let rel = parsePredecessors(succ.predecessors).find(p => p.wbs === task.wbs_code);
          if (rel && succ.LS_date) {
            let s_ls = new Date(succ.LS_date);
            if (rel.type === 'FS') {
              let potLF = new Date(s_ls); potLF.setDate(potLF.getDate() - 1 - rel.lag);
              if (potLF < minLF) minLF = potLF;
            }
          }
        });
        lfDate = minLF;
      }
      task.LF_date = lfDate.toISOString().split('T')[0];
      let lsDate = new Date(lfDate);
      let dur = task.duration; let tempDur = 1;
      while (tempDur < dur) {
        lsDate.setDate(lsDate.getDate() - 1);
        if (isWorkingDay(lsDate, workingDays, exceptionsSet)) tempDur++;
      }
      task.LS_date = lsDate.toISOString().split('T')[0];
      let es = new Date(task.ES_date); let ls = new Date(task.LS_date);
      let floatDays = Math.round((ls - es) / (1000 * 60 * 60 * 24));
      task.total_float = floatDays > 0 ? floatDays : 0;
      task.is_critical = task.total_float === 0;
    };

    const sortedFlat = Object.values(taskMap).sort((a,b) => String(b.wbs_code).localeCompare(String(a.wbs_code), undefined, { numeric: true }));
    sortedFlat.forEach(backwardPass);

    const setSummaryCritical = (node) => {
      if (!node.children || node.children.length === 0) return node.is_critical;
      let hasCriticalChild = false;
      node.children.forEach(child => { if (setSummaryCritical(child)) hasCriticalChild = true; });
      node.is_critical = hasCriticalChild;
      return node.is_critical;
    };
    taskTree.forEach(root => setSummaryCritical(root));

    const relations = [];
    Object.values(taskMap).forEach(task => {
      const preds = parsePredecessors(task.predecessors);
      preds.forEach(p => {
        const predTask = taskMap[p.wbs];
        if (predTask) {
          relations.push({
            id: `${p.wbs}-${task.wbs_code}`,
            from: p.wbs,
            to: task.wbs_code,
            type: p.type,
            is_critical: task.is_critical && predTask.is_critical
          });
        }
      });
    });

    return { tasks: convertTreeToFlat(taskTree), relations, error: null };
  } catch (err) {
    console.error("CPM Engine Error:", err);
    return { tasks: rawTasks, relations: [], error: err.message };
  }
};
