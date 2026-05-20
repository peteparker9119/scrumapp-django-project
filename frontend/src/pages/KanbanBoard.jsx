import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'react-toastify';
import { sprintAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import './KanbanBoard.css';

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#64748B' },
  { id: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { id: 'in_review', label: 'In Review', color: '#7C3AED' },
  { id: 'done', label: 'Done', color: '#10B981' },
];

const PRIORITY_COLORS = { critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#10B981' };
const TYPE_ICONS = { story: '📖', bug: '🐛', task: '✅', epic: '⚡' };

export default function KanbanBoard() {
  const { currentProject } = useProject();
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [board, setBoard] = useState({});
  const [loading, setLoading] = useState(true);

  const buildBoard = (items) => {
    const b = {};
    COLUMNS.forEach(c => { b[c.id] = []; });
    items.forEach(item => {
      const col = item.board_status || 'todo';
      if (b[col]) b[col].push(item);
    });
    return b;
  };

  const load = async () => {
    if (!currentProject) { setLoading(false); return; }
    try {
      const res = await sprintAPI.getAll({ project_id: currentProject.id });
      setSprints(res.data);
      const active = res.data.find(s => s.status === 'active');
      if (active) {
        const detail = await sprintAPI.getOne(active.id);
        setActiveSprint(detail.data);
        setBoard(buildBoard(detail.data.items || []));
      }
    } catch { toast.error('Failed to load board'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [currentProject]);

  const handleSprintChange = async (sprintId) => {
    try {
      const res = await sprintAPI.getOne(sprintId);
      setActiveSprint(res.data);
      setBoard(buildBoard(res.data.items || []));
    } catch { toast.error('Failed to load sprint'); }
  };

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const srcCol = source.droppableId;
    const dstCol = destination.droppableId;

    const newBoard = { ...board };
    const item = newBoard[srcCol][source.index];

    newBoard[srcCol] = [...newBoard[srcCol]];
    newBoard[srcCol].splice(source.index, 1);
    newBoard[dstCol] = [...newBoard[dstCol]];
    newBoard[dstCol].splice(destination.index, 0, { ...item, board_status: dstCol });

    setBoard(newBoard);

    try {
      await sprintAPI.updateItemStatus(activeSprint.id, item.id, { status: dstCol });
    } catch {
      toast.error('Failed to update status');
      load();
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  if (!currentProject) return (
    <div>
      <h1 className="page-title">Kanban Board</h1>
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', marginTop: 20 }}>
        Please select a project from the Dashboard first.
      </div>
    </div>
  );

  return (
    <div className="kanban-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kanban Board</h1>
          <p className="page-subtitle">{activeSprint ? activeSprint.name : 'No sprint selected'}</p>
        </div>
        <select
          className="form-control"
          style={{ width: 'auto' }}
          value={activeSprint?.id || ''}
          onChange={e => handleSprintChange(e.target.value)}
        >
          <option value="">Select Sprint...</option>
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
        </select>
      </div>

      {!activeSprint && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Select a sprint to view its Kanban board.
        </div>
      )}

      {activeSprint && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="kanban-board">
            {COLUMNS.map(col => (
              <div key={col.id} className="kanban-column">
                <div className="kanban-col-header" style={{ borderTopColor: col.color }}>
                  <span className="kanban-col-title">{col.label}</span>
                  <span className="kanban-col-count" style={{ background: col.color + '20', color: col.color }}>
                    {board[col.id]?.length || 0}
                  </span>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`kanban-col-body ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                    >
                      {board[col.id]?.map((item, index) => (
                        <Draggable key={item.sprint_item_id} draggableId={String(item.sprint_item_id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`kanban-card ${snapshot.isDragging ? 'dragging' : ''}`}
                            >
                              <div className="kc-header">
                                <span className="kc-type">{TYPE_ICONS[item.item_type]}</span>
                                <div
                                  className="kc-priority"
                                  style={{ background: PRIORITY_COLORS[item.priority] + '20', color: PRIORITY_COLORS[item.priority] }}
                                >
                                  {item.priority}
                                </div>
                              </div>
                              <div className="kc-title">{item.title}</div>
                              <div className="kc-footer">
                                <div className="kc-assignee">
                                  <div className="kc-avatar">{item.assignee_name?.[0] || '?'}</div>
                                  <span>{item.assignee_name || 'Unassigned'}</span>
                                </div>
                                {item.story_points && (
                                  <div className="kc-points">{item.story_points}</div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {board[col.id]?.length === 0 && !snapshot.isDraggingOver && (
                        <div className="kanban-empty">Drop items here</div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
