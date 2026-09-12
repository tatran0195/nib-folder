import { Button } from '@nibleaf/design-system/components/ui/button';
import { useConfirm } from '@nibleaf/design-system/components/ui/confirm';
import { ScrollArea } from '@nibleaf/design-system/components/ui/scroll-area';
import { SegmentedControl } from '@nibleaf/design-system/components/ui/segmented-control';
import { Tabs, TabsList, TabsTrigger } from '@nibleaf/design-system/components/ui/tabs';
import { cn } from '@nibleaf/design-system/lib/utils';
import { useT } from '@nibleaf/i18n/react';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { Link } from '@tanstack/react-router';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Eye,
  FileText,
  FolderPlus,
  Languages,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Pencil,
  Plus,
  Settings2,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Type as TypeIcon,
} from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AddLanguageDialog } from '@/components/editor/add-language-dialog';
import { AiAssist } from '@/components/editor/ai-assist';
import { BranchSwitcher } from '@/components/editor/branch-switcher';
import { CommentsPanel } from '@/components/editor/comments-panel';
import { isDirty, nextHydration, type ServerSnapshot, shouldAutosave } from '@/components/editor/editor-draft';
import { resolveEditorLayout } from '@/components/editor/editor-layout';
import { LanguageSettingsDialog } from '@/components/editor/language-settings-dialog';
import { MarkdownSourceEditor } from '@/components/editor/markdown-source-editor';
import { PageSettingsDialog } from '@/components/editor/page-settings-dialog';
import { ConfigSection, type ConfigSectionId, ConfigSectionList } from '@/components/editor/site-config-panel';
import { SortablePageTree } from '@/components/editor/sortable-page-tree';
import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { detectUnsupportedMdxTags } from '@/components/editor/unsupported-mdx';
import type { Language, PageNode } from '@/hooks/api';
import { PublishControl } from '@/layouts/project';
import { draftPreviewHref } from '@/lib/draft-preview';
import { recordFirstPublishStage } from '@/lib/first-publish-activation';
import { typographyVars } from '@/lib/typography';
import {
  useBranches,
  useComments,
  useCreatePage,
  useDeletePage,
  useLanguages,
  usePage,
  usePages,
  useReorderPages,
  useUpdatePage,
  useUploadAsset,
} from '@/services/documents.service';
import { useProject } from '@/services/projects.service';
import { EditorModeButton } from './components/EditorModeButton';
import { EditorSidebarResizer } from './components/EditorSidebarResizer';

interface ProjectEditorPageProps {
  projectId: string;
  firstPublish?: boolean;
  pageIdParam?: string;
  publishParam?: boolean;
}

export function ProjectEditorPage({ projectId, firstPublish, pageIdParam, publishParam }: ProjectEditorPageProps) {
  const t = useT();
  const { data: project } = useProject(projectId);

  useEffect(() => {
    if (firstPublish && project) void recordFirstPublishStage('editor_entered');
  }, [firstPublish, project]);

  const [view, setView] = useState<'content' | 'config'>('content');
  const [configSection, setConfigSection] = useState<ConfigSectionId>('branding');

  const { data: branches } = useBranches(projectId);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  useEffect(() => {
    if (!branches || branches.length === 0 || activeBranchId) {
      return;
    }
    const fallback = branches.find((b) => b.isDefault) ?? branches[0];
    if (fallback) {
      setActiveBranchId(fallback.id);
    }
  }, [branches, activeBranchId]);

  const { data: languages } = useLanguages(projectId);
  const { data: allPages, isPending } = usePages(projectId, undefined, activeBranchId ?? undefined);
  const createPage = useCreatePage(projectId);
  const deletePage = useDeletePage(projectId);
  const updatePage = useUpdatePage(projectId);
  const uploadAsset = useUploadAsset(projectId);
  const reorderPages = useReorderPages(projectId);
  const confirm = useConfirm();

  const onUploadImage = async (file: File): Promise<string | null> => {
    try {
      return (await uploadAsset.mutateAsync(file)).url;
    } catch {
      toast.error(t('editor.imageUploadFailed'));
      return null;
    }
  };

  const orderedLanguages = useMemo<Language[]>(
    () => [...(languages ?? [])].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.position - b.position),
    [languages],
  );
  const pagesByLanguage = useMemo(() => {
    const map = new Map<string, PageNode[]>();
    for (const page of allPages ?? []) {
      const list = map.get(page.languageId) ?? [];
      list.push(page);
      map.set(page.languageId, list);
    }
    return map;
  }, [allPages]);
  const defaultLanguageId = orderedLanguages[0]?.id ?? null;

  const [selectedId, setSelectedId] = useState<string | null>(pageIdParam ?? null);
  useEffect(() => {
    if (pageIdParam) {
      setSelectedId(pageIdParam);
    }
  }, [pageIdParam]);
  const firstPageId = useMemo(() => (allPages ?? []).find((p) => p.kind === 'PAGE')?.id ?? null, [allPages]);
  const selectedNode = useMemo(() => (allPages ?? []).find((p) => p.id === selectedId) ?? null, [allPages, selectedId]);
  const selectedGroup = selectedNode?.kind === 'GROUP' ? selectedNode : null;
  const activeId = selectedGroup ? null : (selectedId ?? firstPageId);
  const activeTreeId = selectedId ?? activeId;

  const { data: page } = usePage(projectId, activeId ?? undefined);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [railTab, setRailTab] = useState<'comments' | 'ai'>('comments');
  const [railOpen, setRailOpen] = useState(false);
  useEffect(() => {
    setRailOpen(window.localStorage.getItem('nibleaf.editor.railOpen') === '1');
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem('nibleaf.editor.railOpen', railOpen ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }, [railOpen]);

  const [commentMode, setCommentMode] = useState(false);
  const [pendingAnchor, setPendingAnchor] = useState<{ quote: string; from: number; to: number } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'visual' | 'wysiwyg' | 'markdown'>('visual');
  useEffect(() => {
    const stored = window.localStorage.getItem('nibleaf.editor.contentMode');
    setEditorMode(stored === 'wysiwyg' || stored === 'markdown' ? stored : 'visual');
  }, []);
  const unsupportedTags = useMemo(() => detectUnsupportedMdxTags(content), [content]);
  const effectiveMode = editorMode;
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [addLangOpen, setAddLangOpen] = useState(false);
  const [settingsForId, setSettingsForId] = useState<string | null>(null);
  const [langSettings, setLangSettings] = useState<Language | null>(null);
  const [synced, setSynced] = useState<ServerSnapshot | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(260);
  useEffect(() => {
    const stored = Number(window.localStorage.getItem('nibleaf.editor.sidebarWidth'));
    setSidebarWidth(stored >= 200 && stored <= 520 ? stored : 260);
  }, []);
  useEffect(() => {
    window.localStorage.setItem('nibleaf.editor.sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);
  useEffect(() => {
    try {
      window.localStorage.setItem('nibleaf.editor.contentMode', editorMode);
    } catch {
      // ignore storage failures
    }
  }, [editorMode]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem('nibleaf.editor.sidebarCollapsed') === '1');
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem('nibleaf.editor.sidebarCollapsed', sidebarCollapsed ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }, [sidebarCollapsed]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [collapsedLangs, setCollapsedLangs] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') {
      return new Set();
    }
    try {
      const raw = window.localStorage.getItem('nibleaf.editor.collapsedLangs');
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const persistLangs = (set: Set<string>) => {
    try {
      window.localStorage.setItem('nibleaf.editor.collapsedLangs', JSON.stringify([...set]));
    } catch {
      // ignore storage failures
    }
  };
  const toggleLang = (id: string) => {
    const next = new Set(collapsedLangs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setCollapsedLangs(next);
    persistLangs(next);
  };
  const expandLang = (id: string) => {
    if (!collapsedLangs.has(id)) {
      return;
    }
    const next = new Set(collapsedLangs);
    next.delete(id);
    setCollapsedLangs(next);
    persistLangs(next);
  };

  const activeLanguage = useMemo(() => languages?.find((l) => l.id === page?.languageId), [languages, page?.languageId]);
  const activeLangDir: 'ltr' | 'rtl' = activeLanguage?.direction === 'RTL' ? 'rtl' : 'ltr';

  const hydration = nextHydration({ synced, draft: { title, content } }, page);
  if (hydration) {
    setSynced(hydration);
    setTitle(hydration.title);
    setContent(hydration.content);
    setStatus('idle');
  }

  const saveDraft = useDebouncedCallback(
    (pageId: string, draft: { title: string; content: string }) => {
      updatePage.mutate(
        { pageId, body: draft },
        {
          onSuccess: (saved) => {
            setStatus('saved');
            setSynced((current) =>
              current?.id === pageId ? { id: pageId, title: draft.title, content: draft.content, updatedAt: saved.updatedAt } : current,
            );
          },
          onError: () => setStatus('idle'),
        },
      );
    },
    { wait: 700, onUnmount: (d) => d.flush() },
  );

  useEffect(() => {
    if (!page || !shouldAutosave({ synced, draft: { title, content } }, page)) {
      return;
    }
    setStatus('saving');
    saveDraft(page.id, { title, content });
  }, [title, content, page, synced, saveDraft]);

  const openDraftPreview = async () => {
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) {
      toast.error(t('editor.previewPopupBlocked'));
      return;
    }
    previewWindow.opener = null;

    const previewUrl = draftPreviewHref(projectId, {
      branchId: activeBranchId ?? undefined,
      languageId: page?.languageId,
      pageId: page?.id,
    });

    try {
      const draftIsCurrent = page && synced?.id === page.id && !isDirty({ synced, draft: { title, content } });
      if (page && !draftIsCurrent) {
        setStatus('saving');
        const saved = await updatePage.mutateAsync({ pageId: page.id, body: { title, content } });
        setSynced((current) => (current?.id === page.id ? { id: page.id, title, content, updatedAt: saved.updatedAt } : current));
        setStatus('saved');
      }
      previewWindow.location.replace(previewUrl);
    } catch {
      previewWindow.close();
      setStatus('idle');
      toast.error(t('editor.previewSaveError'));
    }
  };

  const branchScope = activeBranchId ? { branchId: activeBranchId } : {};
  const creationInFlight = useRef(false);
  const addPage = (parentId: string | null, languageId: string) => {
    if (creationInFlight.current) return;
    creationInFlight.current = true;
    createPage.mutate(
      { title: t('editor.untitled'), slug: 'untitled', parentId, languageId, ...branchScope },
      {
        onSuccess: (created) => setSelectedId(created.id),
        onError: (e) => toast.error(e instanceof Error ? e.message : t('editor.createFailed')),
        onSettled: () => {
          creationInFlight.current = false;
        },
      },
    );
  };
  const addGroup = (languageId: string) => {
    if (creationInFlight.current) return;
    creationInFlight.current = true;
    createPage.mutate(
      { title: t('editor.newGroup'), kind: 'GROUP', slug: 'new-group', languageId, ...branchScope },
      {
        onSuccess: (created) => {
          setSelectedId(created.id);
          setSettingsForId(created.id);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : t('editor.createFailed')),
        onSettled: () => {
          creationInFlight.current = false;
        },
      },
    );
  };

  const [focusedTreeOpen, setFocusedTreeOpen] = useState(false);
  const { markdownFocused, navigationCollapsed, treeOverlay, navigationHidden, showRail } = resolveEditorLayout({
    view,
    mode: effectiveMode,
    hasPage: Boolean(activeId && page),
    sidebarCollapsed,
    railOpen,
    focusedTreeOpen,
  });
  useEffect(() => {
    if (!markdownFocused) {
      setFocusedTreeOpen(false);
    }
  }, [markdownFocused]);
  useEffect(() => {
    if (!treeOverlay) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        setFocusedTreeOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [treeOverlay]);

  const { data: pageComments } = useComments(projectId, activeId ?? undefined);
  const commentMarkers = useMemo(
    () => (pageComments ?? []).filter((c) => c.anchor?.quote).map((c) => ({ id: c.id, quote: c.anchor?.quote ?? '', resolved: c.resolved })),
    [pageComments],
  );
  const toggleCommentMode = () => {
    const next = !commentMode;
    if (next) {
      setEditorMode('visual');
      setRailOpen(true);
      setRailTab('comments');
    } else {
      setPendingAnchor(null);
    }
    setCommentMode(next);
  };

  const pageTitleInput = (
    <input
      aria-label={t('editor.pageTitlePlaceholder')}
      className="w-full min-w-0 rounded-sm border-0 bg-transparent font-semibold text-3xl leading-[1.2] tracking-tight outline-none placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/40 sm:text-[2.1rem]"
      dir="auto"
      lang={activeLanguage?.code}
      onChange={(event) => setTitle(event.target.value)}
      placeholder={t('editor.pageTitlePlaceholder')}
      value={title}
    />
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-border border-b bg-background px-2 sm:gap-2.5 sm:px-3">
        <Link
          to="/app/projects/$projectId"
          params={{ projectId }}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={t('editor.backToDashboard')}
        >
          <ChevronLeft className="size-4 rtl:-scale-x-100" />
          {project?.name ? <span className="hidden max-w-[200px] truncate font-medium text-foreground text-sm sm:inline">{project.name}</span> : null}
        </Link>
        {project?.name ? <span className="hidden h-5 w-px bg-border sm:block" /> : null}
        <BranchSwitcher
          projectId={projectId}
          branches={branches ?? []}
          activeBranchId={activeBranchId}
          onSwitch={(id) => {
            setActiveBranchId(id);
            setSelectedId(null);
            setSynced(null);
          }}
        />
        <span className="hidden items-center gap-1.5 text-muted-foreground text-xs lg:flex">
          {status === 'saving' ? (
            <>
              <Loader2 className="size-3 animate-spin" /> {t('editor.savingShort')}
            </>
          ) : status === 'saved' ? (
            <>
              <Check className="size-3 text-primary" /> {t('editor.savedShort')}
            </>
          ) : null}
        </span>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <Button
            aria-label={t('editor.mode.configuration')}
            size="sm"
            variant={view === 'config' ? 'secondary' : 'ghost'}
            className="cursor-pointer"
            onClick={() => {
              const nextView = view === 'config' ? 'content' : 'config';
              setView(nextView);
              if (nextView === 'config') {
                setSidebarCollapsed(false);
                setMobileSidebarOpen(true);
              }
            }}
          >
            <SlidersHorizontal className="size-3.5" /> <span className="hidden md:inline">{t('editor.mode.configuration')}</span>
          </Button>
          <Button aria-label={t('project.preview')} onClick={() => void openDraftPreview()} size="sm" variant="outline" className="cursor-pointer">
            <Eye className="size-3.5" /> <span className="hidden md:inline">{t('project.preview')}</span>
          </Button>
          {project ? <PublishControl project={project} initialPublishOpen={publishParam} /> : null}
        </div>
      </header>

      <div
        className={cn(
          'relative grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)]',
          !treeOverlay && 'lg:grid-cols-[var(--editor-sidebar)_1fr]',
          showRail && 'xl:grid-cols-[var(--editor-sidebar)_1fr_300px]',
        )}
        style={{ '--editor-sidebar': navigationCollapsed ? '0px' : `${sidebarWidth}px` } as CSSProperties}
      >
        {treeOverlay ? (
          <button
            type="button"
            aria-label={t('editor.hidePages')}
            className="absolute inset-0 z-20 cursor-default bg-background/40"
            onClick={() => setFocusedTreeOpen(false)}
          />
        ) : null}
        <aside
          className={cn(
            'relative flex min-h-0 flex-col overflow-hidden border-border border-e bg-sidebar/95',
            treeOverlay
              ? 'absolute inset-y-0 start-0 z-30 w-[min(85vw,320px)] shadow-xl'
              : 'max-lg:absolute max-lg:inset-y-0 max-lg:start-0 max-lg:z-30 max-lg:w-[min(85vw,320px)] max-lg:shadow-xl lg:bg-sidebar/40',
            !mobileSidebarOpen && !treeOverlay && 'max-lg:hidden',
            navigationHidden && 'invisible pointer-events-none border-e-0',
          )}
          aria-hidden={navigationHidden}
          inert={navigationHidden}
        >
          {!navigationCollapsed ? <EditorSidebarResizer onResize={setSidebarWidth} /> : null}
          <div className="flex h-12 shrink-0 items-center justify-between border-border border-b ps-3 pe-1.5">
            <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
              {view === 'config' ? t('editor.config.heading') : t('editor.pages')}
            </span>
            <Button
              size="icon-xs"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => {
                if (treeOverlay) {
                  setFocusedTreeOpen(false);
                } else if (window.matchMedia('(max-width: 1023px)').matches) {
                  setMobileSidebarOpen(false);
                } else {
                  setSidebarCollapsed(true);
                }
              }}
              aria-label={treeOverlay ? t('editor.hidePages') : t('editor.hideSidebar')}
              title={treeOverlay ? t('editor.hidePages') : t('editor.hideSidebar')}
            >
              <PanelLeftClose className="size-3.5 rtl:-scale-x-100" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1 px-2 py-2">
              {view === 'config' ? (
                <ConfigSectionList
                  active={configSection}
                  onSelect={(section) => {
                    setConfigSection(section);
                    setMobileSidebarOpen(false);
                  }}
                />
              ) : isPending ? (
                <p className="px-2 text-muted-foreground text-sm">{t('common.loading')}</p>
              ) : (
                <>
                  {orderedLanguages.map((lang) => {
                    const dir = lang.direction === 'RTL' ? 'rtl' : 'ltr';
                    const langPages = pagesByLanguage.get(lang.id) ?? [];
                    const langCollapsed = collapsedLangs.has(lang.id);
                    return (
                      <div key={lang.id} className="mb-2">
                        <div className="group flex items-center justify-between rounded-md px-1 py-1.5 hover:bg-muted/40">
                          <button
                            type="button"
                            onClick={() => toggleLang(lang.id)}
                            aria-expanded={!langCollapsed}
                            title={langCollapsed ? t('editor.expand') : t('editor.collapse')}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 font-semibold text-[12.5px] text-foreground"
                            dir={dir}
                          >
                            <ChevronRight
                              className={cn(
                                'size-3.5 shrink-0 text-muted-foreground transition-transform',
                                langCollapsed ? 'rtl:rotate-180' : 'rotate-90',
                              )}
                            />
                            <Languages className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 truncate" title={`${lang.label} (${lang.code})`}>
                              {lang.label}
                            </span>
                            {lang.isDefault ? (
                              <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 font-medium text-[9px] text-accent-foreground">
                                {t('editor.default')}
                              </span>
                            ) : null}
                          </button>
                          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="cursor-pointer"
                              onClick={() => setLangSettings(lang)}
                              aria-label={t('editor.langSettings.settings')}
                              title={t('editor.langSettings.settings')}
                            >
                              <Settings2 className="size-3" />
                            </Button>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="cursor-pointer"
                              onClick={() => {
                                expandLang(lang.id);
                                addGroup(lang.id);
                              }}
                              aria-label={t('editor.newGroup')}
                              title={t('editor.newGroup')}
                              disabled={createPage.isPending}
                            >
                              <FolderPlus className="size-3" />
                            </Button>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="cursor-pointer"
                              onClick={() => {
                                expandLang(lang.id);
                                addPage(null, lang.id);
                              }}
                              aria-label={t('editor.newPage')}
                              title={t('editor.newPage')}
                              disabled={createPage.isPending}
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                        </div>

                        {langCollapsed ? null : (
                          <div className="space-y-0.5" dir={dir}>
                            {langPages.length === 0 ? (
                              <p className="px-2 py-1 text-[12px] text-muted-foreground/70">{t('editor.noPagesYet')}</p>
                            ) : (
                              <SortablePageTree
                                pages={langPages}
                                activeId={activeTreeId}
                                treeKey={lang.id}
                                onSelect={(id) => {
                                  setSelectedId(id);
                                  setMobileSidebarOpen(false);
                                  setFocusedTreeOpen(false);
                                }}
                                onAddChild={(parentId) => addPage(parentId, lang.id)}
                                onSettings={(id) => setSettingsForId(id)}
                                onMove={(items) => reorderPages.mutate({ items })}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setAddLangOpen(true)}
                    className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="size-3.5" /> {t('editor.addLanguage')}
                  </button>
                </>
              )}
            </div>
          </ScrollArea>
          <AddLanguageDialog projectId={projectId} open={addLangOpen} onOpenChange={setAddLangOpen} onCreated={() => setAddLangOpen(false)} />
          {langSettings ? (
            <LanguageSettingsDialog
              projectId={projectId}
              language={langSettings}
              open={Boolean(langSettings)}
              onOpenChange={(o) => !o && setLangSettings(null)}
            />
          ) : null}
          {settingsForId
            ? (() => {
                const target = (allPages ?? []).find((p) => p.id === settingsForId);
                return target ? (
                  <PageSettingsDialog projectId={projectId} page={target} open onOpenChange={(o) => !o && setSettingsForId(null)} />
                ) : null;
              })()
            : null}
        </aside>

        {view === 'config' ? (
          <section className="min-h-0 min-w-0 overflow-y-auto">
            <div className="border-border border-b px-6 py-3">
              <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">{t('editor.config.heading')}</span>
            </div>
            <div className="mx-auto w-full max-w-6xl px-5 pt-7 pb-32 sm:px-8">
              {project ? (
                <div className={cn('w-full', configSection === 'themes' ? 'max-w-6xl' : 'max-w-4xl')}>
                  <ConfigSection project={project} section={configSection} />
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
              )}
            </div>
          </section>
        ) : selectedGroup ? (
          <section className="grid place-items-center px-6 text-center">
            <div className="max-w-sm">
              <FolderPlus className="mx-auto size-7 text-muted-foreground" />
              <h1 className="mt-3 font-semibold text-xl tracking-tight">{selectedGroup.title}</h1>
              <p className="mt-1 text-muted-foreground text-sm">{t('editor.groupSelectedHint')}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="outline" onClick={() => setSettingsForId(selectedGroup.id)}>
                  <Settings2 className="size-4" /> {t('editor.pageSettings.title')}
                </Button>
                {selectedGroup.languageId ? (
                  <Button disabled={createPage.isPending} onClick={() => addPage(selectedGroup.id, selectedGroup.languageId)}>
                    <Plus className="size-4" /> {t('editor.newPage')}
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
        ) : activeId && !page ? (
          <section className="grid place-items-center text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </section>
        ) : activeId && page ? (
          <section className="flex min-h-0 min-w-0 flex-col">
            <div className="flex min-h-12 flex-wrap items-center gap-1 border-border border-b px-2 py-1.5 sm:gap-2 sm:px-4 sm:py-0">
              {markdownFocused ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="cursor-pointer"
                  onClick={() => setFocusedTreeOpen(true)}
                  aria-expanded={treeOverlay}
                  aria-label={t('editor.showPages')}
                  title={t('editor.showPages')}
                >
                  <PanelLeftOpen className="size-4 rtl:-scale-x-100" />
                </Button>
              ) : !mobileSidebarOpen ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn('cursor-pointer', !sidebarCollapsed && 'lg:hidden')}
                  onClick={() => {
                    setSidebarCollapsed(false);
                    setMobileSidebarOpen(true);
                  }}
                  aria-label={t('editor.showSidebar')}
                  title={t('editor.showSidebar')}
                >
                  <PanelLeftOpen className="size-4 rtl:-scale-x-100" />
                </Button>
              ) : null}
              <SegmentedControl density="compact" className="ms-auto">
                <EditorModeButton active={effectiveMode === 'visual'} onClick={() => setEditorMode('visual')} icon={<Pencil className="size-3.5" />}>
                  {t('editor.mode.visual')}
                </EditorModeButton>
                <EditorModeButton
                  active={effectiveMode === 'wysiwyg'}
                  onClick={() => setEditorMode('wysiwyg')}
                  icon={<TypeIcon className="size-3.5" />}
                >
                  {t('editor.mode.wysiwyg')}
                </EditorModeButton>
                <EditorModeButton
                  active={effectiveMode === 'markdown'}
                  onClick={() => setEditorMode('markdown')}
                  icon={<Code2 className="size-3.5" />}
                >
                  {t('editor.mode.markdown')}
                </EditorModeButton>
              </SegmentedControl>
              <Button
                size="sm"
                variant={commentMode ? 'secondary' : 'ghost'}
                aria-pressed={commentMode}
                className={cn('cursor-pointer', commentMode && 'bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/35 dark:text-amber-300')}
                onClick={toggleCommentMode}
                title={t('editor.comments.mode')}
              >
                <MessageSquare className="size-4" />
                <span className="hidden md:inline">{commentMode ? t('editor.comments.commenting') : t('editor.comments.mode')}</span>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => activeId && setSettingsForId(activeId)}
                aria-label={t('editor.pageSettings.title')}
                title={t('editor.pageSettings.title')}
              >
                <Settings2 className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="cursor-pointer"
                aria-label={t('editor.deletePage')}
                title={t('editor.deletePage')}
                onClick={async () => {
                  const ok = await confirm({
                    title: t('editor.deletePage'),
                    description: t('editor.deletePageConfirm'),
                    confirmLabel: t('editor.deletePage'),
                    destructive: true,
                  });
                  if (ok) {
                    deletePage.mutate(page.id, { onSuccess: () => setSelectedId(null) });
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
              {!markdownFocused ? (
                <Button
                  aria-label={railOpen ? t('editor.hideRail') : t('editor.showRail')}
                  aria-pressed={railOpen}
                  className="hidden cursor-pointer xl:inline-flex"
                  onClick={() => setRailOpen((v) => !v)}
                  size="icon-sm"
                  title={railOpen ? t('editor.hideRail') : t('editor.showRail')}
                  variant={railOpen ? 'secondary' : 'ghost'}
                >
                  <PanelRight className="size-4" />
                </Button>
              ) : null}
            </div>

            <div
              className={cn(
                'min-h-0 flex-1',
                effectiveMode === 'markdown'
                  ? 'flex flex-col overflow-hidden'
                  : effectiveMode === 'wysiwyg'
                    ? 'flex flex-col overflow-hidden'
                    : 'overflow-y-auto px-4 py-6 sm:px-7 sm:py-8',
              )}
            >
              {unsupportedTags.length > 0 && effectiveMode !== 'markdown' ? (
                <div
                  className={cn(
                    'flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-[13px] text-amber-700 leading-snug dark:text-amber-300',
                    effectiveMode === 'wysiwyg' ? 'mx-4 mt-4 sm:mx-7' : 'mx-auto mb-5 max-w-[720px]',
                  )}
                  role="status"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>{t('editor.unsupportedMdx.banner', { tags: unsupportedTags.join(', ') })}</p>
                </div>
              ) : null}
              {effectiveMode === 'visual' ? <div className="mx-auto max-w-[720px]">{pageTitleInput}</div> : null}
              {effectiveMode === 'visual' || effectiveMode === 'wysiwyg' ? (
                <TiptapEditor
                  key={page.id}
                  value={content}
                  onChange={setContent}
                  className={effectiveMode === 'wysiwyg' ? 'min-h-0 flex-1' : undefined}
                  dir={activeLangDir}
                  lang={activeLanguage?.code}
                  style={typographyVars(project?.config?.typography)}
                  onUpload={onUploadImage}
                  comments={commentMarkers}
                  activeCommentId={activeCommentId}
                  commentMode={commentMode}
                  onAddComment={(anchor) => {
                    setPendingAnchor(anchor);
                    setRailOpen(true);
                    setRailTab('comments');
                  }}
                  titleSlot={effectiveMode === 'wysiwyg' ? pageTitleInput : undefined}
                  variant={effectiveMode === 'wysiwyg' ? 'wysiwyg' : 'visual'}
                />
              ) : (
                <MarkdownSourceEditor
                  key={page.id}
                  dir={activeLangDir}
                  label={t('editor.markdownPlaceholder')}
                  value={content}
                  onChange={setContent}
                  placeholder={t('editor.markdownPlaceholder')}
                  titleSlot={pageTitleInput}
                />
              )}
            </div>
          </section>
        ) : (
          <section className="grid place-items-center text-center">
            <div>
              <FileText className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 font-medium">{t('editor.noPageSelected')}</p>
              <p className="mt-1 text-muted-foreground text-sm">{t('editor.noPageSelectedHint')}</p>
              {defaultLanguageId ? (
                <Button className="mt-4 cursor-pointer" disabled={createPage.isPending} onClick={() => addPage(null, defaultLanguageId)}>
                  <Plus className="size-4" /> {t('editor.newPage')}
                </Button>
              ) : null}
            </div>
          </section>
        )}

        {showRail && activeId ? (
          <aside className="hidden min-h-0 flex-col overflow-hidden border-border border-s bg-sidebar/40 xl:flex">
            <Tabs value={railTab} onValueChange={(value) => setRailTab(value === 'ai' ? 'ai' : 'comments')} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="m-2 self-start">
                <TabsTrigger value="comments">{t('editor.comments')}</TabsTrigger>
                <TabsTrigger value="ai">{t('editor.ai')}</TabsTrigger>
              </TabsList>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">
                {railTab === 'comments' ? (
                  <CommentsPanel
                    pageId={activeId}
                    projectId={projectId}
                    pendingAnchor={pendingAnchor}
                    onClearPending={() => setPendingAnchor(null)}
                    activeCommentId={activeCommentId}
                    onSelectComment={setActiveCommentId}
                    commentMode={commentMode}
                  />
                ) : (
                  <AiAssist content={content} onContentChange={setContent} projectId={projectId} />
                )}
              </div>
            </Tabs>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

export default ProjectEditorPage;
