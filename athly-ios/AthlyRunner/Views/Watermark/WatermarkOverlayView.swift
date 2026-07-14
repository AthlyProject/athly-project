import SwiftUI

/// A marca d'água sobreposta à foto. A MESMA view serve para (1) o preview ao vivo na câmera
/// e (2) a composição final em resolução cheia (via `WatermarkRenderer` + `ImageRenderer`):
/// tudo é dimensionado por um fator `scale` relativo a uma largura de referência, então o
/// layout fica idêntico independente do tamanho em que é renderizada.
///
/// Fundo transparente de propósito — só os elementos da marca aparecem ao compor sobre a foto.
struct WatermarkOverlayView: View {
    let style: WatermarkStyle
    let data: WatermarkData

    /// Largura de referência (iPhone retrato). `scale = larguraReal / referência`.
    private let referenceWidth: CGFloat = 390

    var body: some View {
        GeometryReader { geo in
            let scale = max(geo.size.width / referenceWidth, 0.1)
            content(scale: scale)
                .frame(width: geo.size.width, height: geo.size.height, alignment: .bottomLeading)
        }
    }

    @ViewBuilder
    private func content(scale: CGFloat) -> some View {
        switch style {
        case .heroBar:
            heroBar(scale: scale)
        case .glassCard:
            glassCard(scale: scale)
        case .bigNumber:
            bigNumber(scale: scale)
        case .routeSignature:
            // Sem GPS (indoor/esteira/histórico sem rota) cai no layout da Barra Hero.
            if data.hasRoute {
                routeSignature(scale: scale)
            } else {
                heroBar(scale: scale)
            }
        }
    }

    // MARK: - 1 · Barra Hero (faixa no rodapé)

    private func heroBar(scale: CGFloat) -> some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            VStack(spacing: 0) {
                Rectangle()
                    .fill(AthlyTheme.Gradient.neon)
                    .frame(height: 2 * scale)

                HStack(alignment: .center, spacing: 10 * scale) {
                    brandStack(scale: scale)
                    Spacer(minLength: 8 * scale)
                    metricColumn(value: data.formattedDistance, unit: "KM", scale: scale)
                    barDivider(scale: scale)
                    metricColumn(value: data.formattedDuration, unit: "TEMPO", scale: scale)
                    barDivider(scale: scale)
                    metricColumn(value: data.formattedPace, unit: "/KM", scale: scale)
                }
                .padding(.horizontal, 18 * scale)
                .padding(.top, 13 * scale)
                .padding(.bottom, 22 * scale)
                .background(
                    LinearGradient(
                        colors: [.clear, .black.opacity(0.55), .black.opacity(0.82)],
                        startPoint: .top, endPoint: .bottom
                    )
                )
            }
        }
    }

    private func brandStack(scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 3 * scale) {
            HStack(spacing: 6 * scale) {
                Image("AthlyLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 22 * scale)
                Text("ATHLY")
                    .font(.custom("SpaceGrotesk-Bold", size: 17 * scale))
                    .foregroundStyle(.white)
                    .tracking(1.5 * scale)
            }
            Text(data.formattedDate)
                .font(.custom("SpaceGrotesk-Regular", size: 10 * scale))
                .foregroundStyle(.white.opacity(0.7))
                .lineLimit(1)
        }
    }

    private func metricColumn(value: String, unit: String, scale: CGFloat) -> some View {
        VStack(spacing: 2 * scale) {
            Text(value)
                .font(.custom("SpaceGrotesk-Bold", size: 23 * scale).monospacedDigit())
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text(unit)
                .font(.custom("SpaceGrotesk-SemiBold", size: 9 * scale))
                .foregroundStyle(AthlyTheme.Color.primary)
                .tracking(0.5 * scale)
        }
        .fixedSize()
    }

    private func barDivider(scale: CGFloat) -> some View {
        Rectangle()
            .fill(Color.white.opacity(0.18))
            .frame(width: 1, height: 26 * scale)
    }

    // MARK: - 2 · Card Glass Neon (cartão no canto)

    private func glassCard(scale: CGFloat) -> some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 11 * scale) {
                    HStack(spacing: 7 * scale) {
                        Image("AthlyLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(height: 20 * scale)
                        Text("Athly")
                            .font(.custom("SpaceGrotesk-SemiBold", size: 13 * scale))
                            .foregroundStyle(.white)
                    }
                    cardMetric(icon: "ruler", value: "\(data.formattedDistance) km", scale: scale)
                    cardMetric(icon: "clock", value: data.formattedDuration, scale: scale)
                    cardMetric(icon: "speedometer", value: "\(data.formattedPace) /km", scale: scale)
                    if let cal = data.formattedCalories {
                        cardMetric(icon: "flame", value: "\(cal) kcal", scale: scale)
                    }
                }
                .padding(17 * scale)
                .background(
                    RoundedRectangle(cornerRadius: 22 * scale, style: .continuous)
                        .fill(AthlyTheme.Color.surfaceCard.opacity(0.72))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 22 * scale, style: .continuous)
                        .stroke(AthlyTheme.Gradient.gradientBorder, lineWidth: 1.2 * scale)
                )
                .shadow(color: AthlyTheme.Color.primary.opacity(0.4), radius: 14 * scale, y: 4 * scale)

                Spacer(minLength: 0)
            }
        }
        .padding(20 * scale)
    }

    private func cardMetric(icon: String, value: String, scale: CGFloat) -> some View {
        HStack(spacing: 9 * scale) {
            Image(systemName: icon)
                .font(.system(size: 13 * scale))
                .foregroundStyle(AthlyTheme.Color.primary)
                .frame(width: 18 * scale, alignment: .center)
            Text(value)
                .font(.custom("SpaceGrotesk-SemiBold", size: 16 * scale).monospacedDigit())
                .foregroundStyle(.white)
        }
    }

    // MARK: - 3 · Número Gigante (editorial)

    private func bigNumber(scale: CGFloat) -> some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 6 * scale) {
                    HStack(alignment: .lastTextBaseline, spacing: 6 * scale) {
                        Text(data.formattedDistance)
                            .font(.custom("SpaceGrotesk-Bold", size: 76 * scale))
                            .foregroundStyle(AthlyTheme.Gradient.neon)
                        Text("KM")
                            .font(.custom("SpaceGrotesk-Bold", size: 22 * scale))
                            .foregroundStyle(.white)
                    }
                    HStack(spacing: 18 * scale) {
                        inlineMetric(label: "TEMPO", value: data.formattedDuration, scale: scale)
                        inlineMetric(label: "PACE", value: "\(data.formattedPace) /km", scale: scale)
                    }
                    HStack(spacing: 6 * scale) {
                        Image("AthlyLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(height: 15 * scale)
                        Text("Athly · \(data.formattedDate)")
                            .font(.custom("SpaceGrotesk-Regular", size: 10 * scale))
                            .foregroundStyle(.white.opacity(0.75))
                            .lineLimit(1)
                    }
                    .padding(.top, 4 * scale)
                }
                .shadow(color: .black.opacity(0.45), radius: 8 * scale, y: 2 * scale)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 22 * scale)
            .padding(.bottom, 30 * scale)
        }
    }

    private func inlineMetric(label: String, value: String, scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 1 * scale) {
            Text(label)
                .font(.custom("SpaceGrotesk-SemiBold", size: 9 * scale))
                .foregroundStyle(AthlyTheme.Color.primary)
                .tracking(0.5 * scale)
            Text(value)
                .font(.custom("SpaceGrotesk-Bold", size: 16 * scale).monospacedDigit())
                .foregroundStyle(.white)
        }
    }

    // MARK: - 4 · Assinatura de Rota (traço GPS)

    private func routeSignature(scale: CGFloat) -> some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            HStack(alignment: .center, spacing: 14 * scale) {
                RouteTraceShape(coordinates: data.routeCoordinates)
                    .stroke(style: StrokeStyle(lineWidth: 2.5 * scale, lineCap: .round, lineJoin: .round))
                    .foregroundStyle(AthlyTheme.Gradient.neon)
                    .frame(width: 96 * scale, height: 64 * scale)
                    .shadow(color: AthlyTheme.Color.primaryNeon.opacity(0.6), radius: 4 * scale)

                VStack(alignment: .leading, spacing: 3 * scale) {
                    HStack(alignment: .lastTextBaseline, spacing: 5 * scale) {
                        Text(data.formattedDistance)
                            .font(.custom("SpaceGrotesk-Bold", size: 30 * scale))
                            .foregroundStyle(.white)
                        Text("km")
                            .font(.custom("SpaceGrotesk-SemiBold", size: 13 * scale))
                            .foregroundStyle(AthlyTheme.Color.primary)
                    }
                    Text("\(data.formattedDuration)  ·  \(data.formattedPace) /km")
                        .font(.custom("SpaceGrotesk-SemiBold", size: 13 * scale).monospacedDigit())
                        .foregroundStyle(.white.opacity(0.92))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }

                Spacer(minLength: 0)

                Image("AthlyLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 20 * scale)
            }
            .padding(.horizontal, 18 * scale)
            .padding(.top, 16 * scale)
            .padding(.bottom, 22 * scale)
            .background(
                LinearGradient(
                    colors: [.clear, .black.opacity(0.5), .black.opacity(0.8)],
                    startPoint: .top, endPoint: .bottom
                )
            )
        }
    }
}
