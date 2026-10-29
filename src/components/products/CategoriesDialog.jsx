import { useState } from 'react';

import { Pencil, Plus, Trash2 } from '../icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FormError from '../shared/FormError';
import { tidyLabel } from '../../utils/validation';

/**
 * The category list, managed in one place.
 *
 * Products choose a category from this list. Adding one here or from the
 * product form goes through category_command, which answers a name that already
 * exists in any capitalisation with the existing category, so "Styro Balls"
 * and "styro balls " cannot both be on the list. Renaming moves every product
 * with it. Removing is offered only for a category nothing is filed under; the
 * database refuses the rest and says how many products are in it.
 */
export default function CategoriesDialog({ categories = [], isLoaded = true, inventory = [], onCommand, onClose }) {
  const [adding, setAdding] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const uses = (name) => inventory.filter((row) => String(row.category ?? '').toLowerCase() === name.toLowerCase()).length;
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  function problem(name, exceptId = null) {
    const tidy = tidyLabel(name);
    if (!tidy) return 'Write a name for the category.';
    if (tidy.length > 60) return 'Keep the category name to 60 characters.';
    const clash = categories.find((c) => c.id !== exceptId && c.name.toLowerCase() === tidy.toLowerCase());
    if (clash) return `There is already a category called "${clash.name}".`;
    return null;
  }

  async function run(action, data, done) {
    setWorking(true);
    setError(null);
    setMessage(null);
    const result = await onCommand(action, data);
    setWorking(false);
    if (!result.ok) { setError(result.message); return; }
    done(result.data);
  }

  async function add(event) {
    event.preventDefault();
    const wrong = problem(adding);
    if (wrong) { setError(wrong); return; }
    await run('add', { name: tidyLabel(adding) }, (data) => {
      setAdding('');
      setMessage(data?.created === false
        ? `"${data.category.name}" was already on the list, so nothing was added.`
        : `"${data?.category?.name ?? tidyLabel(adding)}" was added.`);
    });
  }

  async function rename(event) {
    event.preventDefault();
    const wrong = problem(editing.name, editing.id);
    if (wrong) { setError(wrong); return; }
    await run('rename', { id: editing.id, name: tidyLabel(editing.name) }, (data) => {
      setEditing(null);
      setMessage(`Renamed to "${data?.category?.name}". Every product in it moved with it.`);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !working) onClose(); }}>
      <DialogContent size="md" showClose={!working}>
        <DialogHeader>
          <DialogTitle>Product categories</DialogTitle>
          <DialogDescription>
            Products are grouped by these. Each name appears once, whatever capitals it is typed with.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3.5">
          <FormError message={error} />
          {message && <p role="status" className="m-0 rounded-md border border-success-bd bg-success-bg px-3 py-2 text-13 text-success-fg">{message}</p>}

          <form onSubmit={add} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium">
              New category
              <Input value={adding} maxLength={60} disabled={working} onChange={(e) => { setAdding(e.target.value); setError(null); }} placeholder="Wall art" />
            </label>
            <Button type="submit" disabled={working}>
              <Plus />Add category
            </Button>
          </form>

          {!isLoaded ? (
            <p className="m-0 py-4 text-13 text-muted-fg">Loading the categories…</p>
          ) : sorted.length === 0 ? (
            <p className="m-0 py-4 text-13 text-muted-fg">No categories yet. Add one above, or choose "Add a new category…" when adding a product.</p>
          ) : (
            <ul className="m-0 list-none overflow-hidden rounded-md border border-border p-0">
              {sorted.map((category) => {
                const count = uses(category.name);
                const isEditing = editing?.id === category.id;
                return (
                  <li key={category.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-row-divider px-3 py-1.5 last:border-b-0">
                    {isEditing ? (
                      <form onSubmit={rename} noValidate className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                        <Input aria-label={`New name for ${category.name}`} autoFocus value={editing.name} maxLength={60} disabled={working}
                          onChange={(e) => { setEditing({ ...editing, name: e.target.value }); setError(null); }} className="min-w-0 flex-1" />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={working} onClick={() => setEditing(null)}>Cancel</Button>
                          <Button type="submit" size="sm" disabled={working}>Save name</Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <span className="min-w-0 text-13">
                          <span className="block font-medium">{category.name}</span>
                          <span className="block text-muted-fg">{count === 0 ? 'No products' : count === 1 ? '1 product' : `${count} products`}</span>
                        </span>
                        <span className="flex gap-1.5">
                          <Button variant="ghost" size="sm" disabled={working} onClick={() => { setEditing({ id: category.id, name: category.name }); setError(null); setMessage(null); }}>
                            <Pencil />Rename
                          </Button>
                          <Button variant="ghost" size="sm" disabled={working || count > 0}
                            title={count > 0 ? 'Move its products to another category first.' : undefined}
                            onClick={() => run('remove', { id: category.id }, () => setMessage(`"${category.name}" was removed.`))}>
                            <Trash2 />Remove
                          </Button>
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="m-0 text-13 text-muted-fg">A category with products in it cannot be removed. Rename it, or move its products to another category first.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" disabled={working} onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
