import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Plus, Trash2, Lock } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Chapter {
  name: string;
  nameAr: string;
}

interface Props {
  chapters: Chapter[];
  chapterCount: number;
  onChange: (chapters: Chapter[]) => void;
}

const SortableChapter = ({ chapter, index, onRename, onDelete, locked }: {
  chapter: Chapter; index: number; onRename: (i: number, name: string, nameAr: string) => void;
  onDelete: (i: number) => void; locked: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `ch-${index}` });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-background rounded-md border p-2">
      {!locked && (
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
      <span className="text-xs text-muted-foreground w-5">{index + 1}</span>
      <Input
        value={chapter.name}
        onChange={(e) => onRename(index, e.target.value, chapter.nameAr)}
        disabled={locked}
        className="h-8 text-sm"
      />
      {!locked && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onDelete(index)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

export const ChapterList = ({ chapters, chapterCount, onChange }: Props) => {
  const { t } = useLanguage();
  const locked = chapterCount === 5;
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = chapters.findIndex((_, i) => `ch-${i}` === active.id);
      const newIdx = chapters.findIndex((_, i) => `ch-${i}` === over.id);
      onChange(arrayMove(chapters, oldIdx, newIdx));
    }
  };

  const handleRename = (i: number, name: string, nameAr: string) => {
    const updated = [...chapters];
    updated[i] = { ...updated[i], name };
    onChange(updated);
  };

  const handleDelete = (i: number) => {
    onChange(chapters.filter((_, idx) => idx !== i));
  };

  const handleAdd = () => {
    onChange([...chapters, { name: 'New Chapter', nameAr: 'فصل جديد' }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{t('chapters')}</Label>
        {locked && <Badge variant="secondary" className="text-xs">{t('lockedStructure')}</Badge>}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={chapters.map((_, i) => `ch-${i}`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {chapters.map((ch, i) => (
              <SortableChapter
                key={`ch-${i}`}
                chapter={ch}
                index={i}
                onRename={handleRename}
                onDelete={handleDelete}
                locked={locked}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {!locked && (
        <Button variant="outline" size="sm" onClick={handleAdd} className="w-full gap-1">
          <Plus className="h-3 w-3" /> {t('addChapter')}
        </Button>
      )}
    </div>
  );
};
