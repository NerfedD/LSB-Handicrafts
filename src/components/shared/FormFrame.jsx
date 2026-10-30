import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Page, PageHeader, SectionCard } from "./page";

/**
 * The outside of a form that is a dialog when ADDING and a screen when EDITING.
 *
 * Adding a product or writing an order happens over the list it lands in, the
 * way adding a customer or a user does, so it opens as a dialog (the design's
 * AddProductDialog and NewOrderDialog boards). Editing stays a full screen
 * reached from the record, with a way back to it.
 *
 * The form's fields and buttons are the same either way; only the frame
 * around them changes. A dialog is mounted only while open, so its state
 * starts fresh each time, and it cannot be dismissed while a save is running.
 */
export default function FormFrame({
  asDialog = false,
  size = "lg",
  title,
  description,
  back,
  sectionTitle,
  className,
  saving = false,
  onSubmit,
  onCancel,
  footer,
  children,
}) {
  if (asDialog) {
    return (
      <Dialog open onOpenChange={(next) => { if (!next && !saving) onCancel?.(); }}>
        <DialogContent size={size} showClose={!saving}>
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </DialogHeader>
            <DialogBody>{children}</DialogBody>
            <DialogFooter>{footer}</DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Page>
      <PageHeader back={back} title={title} description={description} />
      <form onSubmit={onSubmit} noValidate className={className}>
        <SectionCard
          title={sectionTitle}
          bodyClassName="flex flex-col gap-3.5 px-4 pb-4"
          footer={<div className="flex justify-end gap-2">{footer}</div>}
        >
          {children}
        </SectionCard>
      </form>
    </Page>
  );
}
