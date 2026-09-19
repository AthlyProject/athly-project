import SwiftUI

// Blocos visuais compartilhados pelas telas de Perfil e Ajustes (design v2).

/// Rótulo de seção em caixa alta, com o tracking do design system.
struct AthlySectionLabel: View {
    private let key: LocalizedStringKey
    private let color: Color

    init(_ key: LocalizedStringKey, color: Color = AthlyTheme.Color.textTertiary) {
        self.key = key
        self.color = color
    }

    var body: some View {
        Text(key)
            .font(AthlyTheme.Typography.semibold(10))
            .kerning(1.2)
            .textCase(.uppercase)
            .foregroundStyle(color)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 6)
    }
}

/// Superfície padrão de cartão: fundo sólido + borda de 1px.
struct AthlySurface: ViewModifier {
    let cornerRadius: CGFloat
    let border: AnyShapeStyle
    let background: Color

    func body(content: Content) -> some View {
        content
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(border, lineWidth: 1)
            )
    }
}

extension View {
    /// Cartão sólido das telas de perfil/ajustes (mais discreto que `athlyCard()`).
    func athlySurface(
        cornerRadius: CGFloat = AthlyTheme.Radius.button,
        background: Color = AthlyTheme.Color.surfaceCard,
        border: some ShapeStyle = AthlyTheme.Color.borderDark
    ) -> some View {
        modifier(
            AthlySurface(
                cornerRadius: cornerRadius,
                border: AnyShapeStyle(border),
                background: background
            )
        )
    }
}

/// Ícone quadrado colorido usado nas linhas de lista e nas células de estatística.
struct AthlyIconTile: View {
    let systemImage: String
    var tint: Color = AthlyTheme.Color.primary
    var background: Color?
    var size: CGFloat = 28

    var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: size * 0.5, weight: .medium))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(background ?? tint.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: size * 0.29, style: .continuous))
    }
}

/// Chip de metadado (nível, meta) exibido sob o nome do atleta.
struct AthlyChip: View {
    let text: String
    var tint: Color = AthlyTheme.Color.textSecondary
    var background: Color = AthlyTheme.Color.surfaceCard
    var border: Color = AthlyTheme.Color.borderMid

    var body: some View {
        Text(text)
            .font(AthlyTheme.Typography.semibold(10))
            .foregroundStyle(tint)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(background)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(border, lineWidth: 1))
    }
}

// MARK: - Lista agrupada

/// Grupo de linhas no estilo do design: um cartão único com divisórias internas.
/// As divisórias são explícitas (`AthlyRowDivider`) para espelhar o `.row + .row` do HTML.
struct AthlyListGroup<Content: View>: View {
    var border: Color = AthlyTheme.Color.borderDark
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            content()
        }
        .athlySurface(border: border)
    }
}

/// Divisória de 1px entre duas linhas de um `AthlyListGroup`.
struct AthlyRowDivider: View {
    var body: some View {
        Rectangle()
            .fill(AthlyTheme.Color.borderDark)
            .frame(height: 1)
    }
}

/// Linha de lista: ícone (opcional) + título/subtítulo + acessório (toggle, valor ou chevron).
struct AthlyListRow<Accessory: View>: View {
    var systemImage: String?
    var tint: Color = AthlyTheme.Color.primary
    var iconBackground: Color?
    let title: Text
    var titleColor: Color = AthlyTheme.Color.textPrimary
    var subtitle: Text?
    var subtitleColor: Color = AthlyTheme.Color.textSecondary
    @ViewBuilder var accessory: () -> Accessory

    var body: some View {
        HStack(spacing: 11) {
            if let systemImage {
                AthlyIconTile(systemImage: systemImage, tint: tint, background: iconBackground)
            }

            VStack(alignment: .leading, spacing: 2) {
                title
                    .font(AthlyTheme.Typography.semibold(15))
                    .foregroundStyle(titleColor)
                if let subtitle {
                    subtitle
                        .font(AthlyTheme.Typography.body(11))
                        .foregroundStyle(subtitleColor)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            accessory()
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

extension AthlyListRow where Accessory == EmptyView {
    init(
        systemImage: String? = nil,
        tint: Color = AthlyTheme.Color.primary,
        iconBackground: Color? = nil,
        title: Text,
        titleColor: Color = AthlyTheme.Color.textPrimary,
        subtitle: Text? = nil,
        subtitleColor: Color = AthlyTheme.Color.textSecondary
    ) {
        self.init(
            systemImage: systemImage,
            tint: tint,
            iconBackground: iconBackground,
            title: title,
            titleColor: titleColor,
            subtitle: subtitle,
            subtitleColor: subtitleColor,
            accessory: { EmptyView() }
        )
    }
}

/// Chevron de navegação das linhas tocáveis.
struct AthlyChevron: View {
    var body: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(AthlyTheme.Color.textTertiary)
    }
}

/// Valor monoespaçado à direita da linha (versão do app, status de integração…).
struct AthlyRowValue: View {
    let text: String
    var color: Color = AthlyTheme.Color.textSecondary

    var body: some View {
        Text(text)
            .font(AthlyTheme.Typography.mono(11))
            .foregroundStyle(color)
    }
}

/// Toggle com o gradiente da marca quando ligado (o `Toggle` nativo só aceita cor sólida).
/// Renderiza **apenas** o trilho — use como acessório de uma `AthlyListRow`, que já traz o
/// título/subtítulo; o rótulo do `Toggle` fica vazio e a linha descreve o controle.
struct AthlyToggleTrackStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.18)) {
                configuration.isOn.toggle()
            }
        } label: {
            track(isOn: configuration.isOn)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isButton)
        .accessibilityValue(Text(configuration.isOn ? "Ativado" : "Desativado"))
    }

    private func track(isOn: Bool) -> some View {
        ZStack {
            Capsule()
                .fill(isOn ? AnyShapeStyle(AthlyTheme.Gradient.brand) : AnyShapeStyle(AthlyTheme.Color.backgroundAlt))
            Capsule()
                .stroke(isOn ? Color.clear : AthlyTheme.Color.borderMid, lineWidth: 1)
            Circle()
                .fill(isOn ? Color.white : AthlyTheme.Color.textSecondary)
                .frame(width: 18, height: 18)
                .frame(maxWidth: .infinity, alignment: isOn ? .trailing : .leading)
                .padding(.horizontal, 3)
        }
        .frame(width: 46, height: 26)
    }
}

/// Botão de largura total usado no rodapé das listas (sair da conta, vincular provedor).
struct AthlyWideButton<Label: View>: View {
    var background: AnyShapeStyle = AnyShapeStyle(AthlyTheme.Color.surfaceCard)
    var border: Color = AthlyTheme.Color.borderMid
    var foreground: Color = AthlyTheme.Color.textPrimary
    let action: () -> Void
    @ViewBuilder var label: () -> Label

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                label()
            }
            .font(AthlyTheme.Typography.semibold(13))
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AthlyTheme.Radius.small, style: .continuous)
                    .stroke(border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
