import Foundation

// MARK: - ActiveSegment

/// A fully-expanded, flat representation of one execution step derived from the
/// `WorkoutSegments` tree. `set` nodes are never in this list — they are expanded
/// into their children N times, each carrying `setIndex` / `setTotal` context.
struct ActiveSegment: Identifiable, Sendable {
    let id: UUID
    /// Back-reference to the source `Segment.id` (ULID) for skip/partial tracking.
    let sourceSegmentId: String
    let kind: SegmentKind
    /// 1-based position within the parent set (nil when not inside a set).
    let setIndex: Int?
    /// Total repetitions of the parent set (nil when not inside a set).
    let setTotal: Int?
    let end: SegmentEndCondition
    let target: SegmentTarget?
    /// Human-readable label used in the UI banner and TTS phrases.
    let label: String
}

// MARK: - WorkoutSegments + flatten

extension WorkoutSegments {

    /// Expand the tree into an ordered flat list ready for the tracker.
    /// `set` nodes are not included; their children are repeated `repetitions` times.
    /// Depth-first traversal, max depth 2 (matching the backend contract).
    func flatten() -> [ActiveSegment] {
        var result: [ActiveSegment] = []
        for seg in segments {
            expand(seg, into: &result, setIndex: nil, setTotal: nil)
        }
        return result
    }

    // MARK: Private

    private func expand(
        _ seg: Segment,
        into result: inout [ActiveSegment],
        setIndex: Int?,
        setTotal: Int?
    ) {
        if seg.kind == .set {
            let reps = seg.repetitions ?? 1
            let children = seg.children ?? []
            guard !children.isEmpty else { return }
            for rep in 1...reps {
                for child in children {
                    expand(child, into: &result, setIndex: rep, setTotal: reps)
                }
            }
            return
        }

        // Non-set leaf node — needs a valid end condition to be trackable.
        guard let end = seg.end else { return }

        let active = ActiveSegment(
            id: UUID(),
            sourceSegmentId: seg.id,
            kind: seg.kind,
            setIndex: setIndex,
            setTotal: setTotal,
            end: end,
            target: seg.target,
            label: seg.label ?? defaultLabel(seg.kind, setIndex: setIndex, setTotal: setTotal)
        )
        result.append(active)
    }

    private func defaultLabel(_ kind: SegmentKind, setIndex: Int?, setTotal: Int?) -> String {
        let base: String
        switch kind {
        case .warmup:   base = "Aquecimento"
        case .work:
            if let idx = setIndex, let total = setTotal {
                return "Tiro \(idx) de \(total)"
            }
            base = "Tiro"
        case .recovery: base = "Recuperação"
        case .cooldown: base = "Desaceleramento"
        case .rest:     base = "Descanso"
        case .set, .unknown: base = "Bloco"
        }
        return base
    }
}
