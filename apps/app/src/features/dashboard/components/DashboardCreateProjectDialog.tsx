import { Button } from '@nibleaf/design-system/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@nibleaf/design-system/components/ui/dialog';
import { FieldError } from '@nibleaf/design-system/components/ui/form-field';
import { Input } from '@nibleaf/design-system/components/ui/input';
import { Label } from '@nibleaf/design-system/components/ui/label';
import { useT } from '@nibleaf/i18n/react';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';
import { required } from '@/lib/form';
import { useCreateProject } from '@/services/projects.service';

interface DashboardCreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DashboardCreateProjectDialog({ open, onOpenChange }: DashboardCreateProjectDialogProps) {
  const create = useCreateProject();
  const t = useT();

  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => {
      await new Promise<void>((resolve) => {
        create.mutate(
          { name: value.name.trim() },
          {
            onSuccess: () => {
              toast.success(t('newSite.created'));
              form.reset();
              onOpenChange(false);
              resolve();
            },
            onError: (error) => {
              toast.error(error instanceof Error ? error.message : t('newSite.error'));
              resolve();
            },
          },
        );
      });
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('newSite.title')}</DialogTitle>
          <DialogDescription>{t('newSite.desc')}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => required(t('newSite.name'), t)(value),
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="project-name">{t('newSite.name')}</Label>
                <Input
                  autoFocus
                  id="project-name"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={t('newSite.namePlaceholder')}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              {t('common.cancel')}
            </Button>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button disabled={!canSubmit || isSubmitting} type="submit">
                  {isSubmitting ? t('newSite.creating') : t('newSite.create')}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DashboardCreateProjectDialog;
