import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SportBadge } from "@/components/SportBadge";
import { getWorkoutById, updateWorkout } from "@/services/workoutService";
import type { Workout } from "@/types";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";

const sportTypes = [
  "running",
  "cycling",
  "swimming",
  "triathlon",
  "duathlon",
  "strength",
  "crossfit",
  "yoga",
  "walking",
  "other",
] as const;

const workoutSchema = z.object({
  title: z.string().min(1, "Informe o título do treino"),
  sportType: z.enum(sportTypes),
  description: z.string().optional(),
  blocks: z
    .array(
      z.object({
        type: z.string().min(1, "Informe o tipo do bloco"),
        duration: z.number().positive().optional(),
        distance: z.number().positive().optional(),
        targetPace: z.string().optional(),
        instructions: z.string().optional(),
      }),
    )
    .min(1, "Adicione pelo menos um bloco"),
});

type WorkoutFormValues = z.infer<typeof workoutSchema>;
type InlineBlockForm = {
  type: string;
  duration: string;
  distance: string;
  targetPace: string;
  instructions: string;
};

export function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(
    null,
  );
  const [inlineBlock, setInlineBlock] = useState<InlineBlockForm | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkoutFormValues>({
    resolver: zodResolver(workoutSchema),
    defaultValues: {
      title: "",
      sportType: "running",
      description: "",
      blocks: [
        {
          type: "",
          duration: undefined,
          distance: undefined,
          targetPace: "",
          instructions: "",
        },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "blocks",
  });

  useEffect(() => {
    if (!id) return;
    getWorkoutById(id).then(setWorkout);
  }, [id]);

  useEffect(() => {
    if (!workout) return;
    reset({
      title: workout.title,
      sportType: workout.sportType,
      description: workout.description ?? "",
      blocks: workout.blocks.map((block) => ({
        type: block.type,
        duration: block.duration,
        distance: block.distance,
        targetPace: block.targetPace ?? "",
        instructions: block.instructions ?? "",
      })),
    });
  }, [reset, workout]);

  const onSubmit = async (values: WorkoutFormValues) => {
    if (!workout) return;
    const payload = {
      title: values.title.trim(),
      sportType: values.sportType,
      description: values.description?.trim() || undefined,
      blocks: values.blocks.map((block) => ({
        type: block.type.trim(),
        duration: block.duration,
        distance: block.distance,
        targetPace: block.targetPace?.trim() || undefined,
        instructions: block.instructions?.trim() || undefined,
      })),
    };

    const updated = await updateWorkout(workout.id, payload);

    setWorkout(updated);
    setIsEditing(false);
    toast.success("Treino atualizado!");
  };

  if (!workout) {
    return (
      <Card>
        <p className="text-center text-slate-600 dark:text-slate-400">
          Treino não encontrado
        </p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">
          Voltar
        </Button>
      </Card>
    );
  }

  const date = new Date(workout.date).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const toNumber = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const startInlineEdit = (block: Workout["blocks"][number], index: number) => {
    setEditingBlockIndex(index);
    setInlineBlock({
      type: block.type,
      duration: block.duration?.toString() ?? "",
      distance: block.distance?.toString() ?? "",
      targetPace: block.targetPace ?? "",
      instructions: block.instructions ?? "",
    });
  };

  const cancelInlineEdit = () => {
    setEditingBlockIndex(null);
    setInlineBlock(null);
  };

  const saveInlineEdit = async () => {
    if (!workout || editingBlockIndex === null || !inlineBlock) return;
    if (!inlineBlock.type.trim()) {
      toast.error("Informe o tipo do bloco");
      return;
    }
    setInlineSaving(true);
    console.log("inlineBlock", inlineBlock);
    const nextBlocks = workout.blocks.map((block, index) =>
      index === editingBlockIndex
        ? {
            type: inlineBlock.type.trim(),
            duration: toNumber(inlineBlock.duration),
            distance: toNumber(inlineBlock.distance),
            targetPace: inlineBlock.targetPace.trim() || undefined,
            instructions: inlineBlock.instructions.trim() || undefined,
          }
        : {
            type: block.type,
            duration: block.duration,
            distance: block.distance,
            targetPace: block.targetPace,
            instructions: block.instructions,
          },
    );

    const payload = {
      title: workout.title,
      sportType: workout.sportType,
      description: workout.description,
      blocks: nextBlocks,
    };

    const updated = await updateWorkout(workout.id, payload);

    setWorkout(updated);
    toast.success("Bloco atualizado!");
    cancelInlineEdit();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SportBadge type={workout.sportType} />
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {workout.title}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">{date}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setIsEditing((current) => !current)}
        >
          {isEditing ? "Cancelar edição" : "Editar treino"}
        </Button>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">
              Informações do treino
            </h2>
            <div className="space-y-4">
              <Input
                label="Título"
                error={errors.title?.message}
                {...register("title")}
              />
              <div>
                <label
                  htmlFor="sportType"
                  className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Modalidade
                </label>
                <select
                  id="sportType"
                  className={`w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white ${
                    errors.sportType
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : ""
                  }`}
                  {...register("sportType")}
                >
                  <option value="running">Corrida</option>
                  <option value="cycling">Ciclismo</option>
                  <option value="swimming">Natação</option>
                  <option value="triathlon">Triathlon</option>
                  <option value="duathlon">Duathlon</option>
                  <option value="strength">Força</option>
                  <option value="crossfit">Crossfit</option>
                  <option value="yoga">Yoga</option>
                  <option value="walking">Caminhada</option>
                  <option value="other">Outro</option>
                </select>
                {errors.sportType?.message && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.sportType.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="description"
                  className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Descrição
                </label>
                <textarea
                  id="description"
                  rows={3}
                  className={`w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 ${
                    errors.description
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : ""
                  }`}
                  placeholder="Detalhes gerais do treino"
                  {...register("description")}
                />
                {errors.description?.message && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.description.message}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Blocos do treino
              </h2>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({
                    type: "",
                    duration: undefined,
                    distance: undefined,
                    targetPace: "",
                    instructions: "",
                  })
                }
              >
                Adicionar bloco
              </Button>
            </div>

            {errors.blocks?.message && (
              <p className="mb-4 text-sm text-red-600 dark:text-red-400">
                {errors.blocks.message}
              </p>
            )}

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Bloco {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      Remover
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <Input
                      label="Tipo"
                      error={errors.blocks?.[index]?.type?.message}
                      {...register(`blocks.${index}.type`)}
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        label="Duração (min)"
                        type="number"
                        min="1"
                        error={errors.blocks?.[index]?.duration?.message}
                        {...register(`blocks.${index}.duration`, {
                          setValueAs: (value) =>
                            value === "" || value === null
                              ? undefined
                              : Number(value),
                        })}
                      />
                      <Input
                        label="Distância (km)"
                        type="number"
                        min="0"
                        step="0.1"
                        error={errors.blocks?.[index]?.distance?.message}
                        {...register(`blocks.${index}.distance`, {
                          setValueAs: (value) =>
                            value === "" || value === null
                              ? undefined
                              : Number(value),
                        })}
                      />
                    </div>
                    <Input
                      label="Ritmo alvo"
                      placeholder="Ex.: 5:30/km"
                      error={errors.blocks?.[index]?.targetPace?.message}
                      {...register(`blocks.${index}.targetPace`)}
                    />
                    <div>
                      <label
                        htmlFor={`blocks.${index}.instructions`}
                        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                      >
                        Instruções
                      </label>
                      <textarea
                        id={`blocks.${index}.instructions`}
                        rows={2}
                        className={`w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 ${
                          errors.blocks?.[index]?.instructions
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : ""
                        }`}
                        placeholder="Detalhes do bloco"
                        {...register(`blocks.${index}.instructions`)}
                      />
                      {errors.blocks?.[index]?.instructions?.message && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors.blocks?.[index]?.instructions?.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-col gap-3">
            <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
              Salvar alterações
            </Button>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={() => {
                reset();
                setIsEditing(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <>
          {workout.description && (
            <Card>
              <h2 className="mb-2 font-semibold text-slate-900 dark:text-white">
                Descrição
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {workout.description}
              </p>
            </Card>
          )}

          <Card>
            <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">
              Blocos do treino
            </h2>
            <div className="space-y-4">
              {workout.blocks.map((block, i) => {
                const isInlineEditing = editingBlockIndex === i && inlineBlock;
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-medium capitalize text-slate-900 dark:text-white">
                        {block.type}
                      </span>
                      <div className="flex items-center gap-3">
                        {(block.duration || block.distance) && (
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {block.duration && `${block.duration} min`}
                            {block.distance && ` • ${block.distance} km`}
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startInlineEdit(block, i)}
                          disabled={
                            editingBlockIndex !== null &&
                            editingBlockIndex !== i
                          }
                        >
                          Editar bloco
                        </Button>
                      </div>
                    </div>

                    {isInlineEditing ? (
                      <div className="mt-4 space-y-3">
                        <Input
                          label="Tipo"
                          value={inlineBlock.type}
                          onChange={(event) =>
                            setInlineBlock({
                              ...inlineBlock,
                              type: event.target.value,
                            })
                          }
                        />
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            label="Duração (min)"
                            type="number"
                            min="1"
                            value={inlineBlock.duration}
                            onChange={(event) =>
                              setInlineBlock({
                                ...inlineBlock,
                                duration: event.target.value,
                              })
                            }
                          />
                          <Input
                            label="Distância (km)"
                            type="number"
                            min="0"
                            step="0.1"
                            value={inlineBlock.distance}
                            onChange={(event) =>
                              setInlineBlock({
                                ...inlineBlock,
                                distance: event.target.value,
                              })
                            }
                          />
                        </div>
                        <Input
                          label="Ritmo alvo"
                          placeholder="Ex.: 5:30/km"
                          value={inlineBlock.targetPace}
                          onChange={(event) =>
                            setInlineBlock({
                              ...inlineBlock,
                              targetPace: event.target.value,
                            })
                          }
                        />
                        <div>
                          <label
                            htmlFor={`inline-instructions-${i}`}
                            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                          >
                            Instruções
                          </label>
                          <textarea
                            id={`inline-instructions-${i}`}
                            rows={2}
                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                            value={inlineBlock.instructions}
                            onChange={(event) =>
                              setInlineBlock({
                                ...inlineBlock,
                                instructions: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="button"
                            size="sm"
                            loading={inlineSaving}
                            onClick={saveInlineEdit}
                          >
                            Salvar bloco
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={cancelInlineEdit}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {block.targetPace && (
                          <p className="mt-1 text-sm text-sky-600 dark:text-sky-400">
                            Ritmo: {block.targetPace}
                          </p>
                        )}
                        {block.instructions && (
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            {block.instructions}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex flex-col gap-3">
            <Button
              fullWidth
              size="lg"
              onClick={() => navigate(`/feedback/${workout.id}`)}
            >
              Concluir treino
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate(`/feedback/${workout.id}?partial=true`)}
            >
              Treino parcial
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => navigate("/dashboard")}
            >
              Pular treino
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
