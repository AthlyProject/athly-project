import SwiftUI

struct AuthWelcomeView: View {
    @State private var showLogin    = false
    @State private var showRegister = false

    var body: some View {
        ZStack {
            AthlyTheme.Color.backgroundDark.ignoresSafeArea()

            RadialGradient(
                colors: [AthlyTheme.Color.primary.opacity(0.16), .clear],
                center: .top, startRadius: 0, endRadius: 280
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [AthlyTheme.Color.secondary.opacity(0.09), .clear],
                center: .bottom, startRadius: 0, endRadius: 240
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()
                logoSection
                Spacer()
                featureList
                    .padding(.horizontal, 20)
                Spacer()
                ctaSection
                    .padding(.horizontal, 20)
                    .padding(.bottom, 36)
            }
        }
        .fullScreenCover(isPresented: $showRegister) { RegisterView() }
        .fullScreenCover(isPresented: $showLogin)    { LoginView() }
    }

    // MARK: - Logo

    private var logoSection: some View {
        VStack(spacing: 16) {
            Image("AthlyLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .shadow(color: AthlyTheme.Color.primary.opacity(0.45), radius: 20, y: 8)

            VStack(spacing: 6) {
                HStack(spacing: 6) {
                    Text("Athly")
                        .foregroundStyle(AthlyTheme.Color.textPrimary)
                    Text("Runner")
                        .foregroundStyle(AthlyTheme.Gradient.brand)
                }
                .font(AthlyTheme.Typography.heading(28))

                Text("Treinos com IA que evoluem com você")
                    .font(AthlyTheme.Typography.body(12))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
        }
    }

    // MARK: - Features

    private var featureList: some View {
        VStack(spacing: 8) {
            featureItem(
                icon: "sparkles",
                iconColor: AthlyTheme.Color.primary,
                iconBg: AthlyTheme.Color.primarySoft,
                iconBorder: AthlyTheme.Color.primaryBorder,
                title: "Plano gerado por IA",
                subtitle: "Adaptado ao seu ritmo e objetivo"
            )
            featureItem(
                icon: "bolt.fill",
                iconColor: AthlyTheme.Color.secondary,
                iconBg: AthlyTheme.Color.secondarySoft,
                iconBorder: AthlyTheme.Color.secondaryBorder,
                title: "Treinos periodizados",
                subtitle: "Sprint, intervalado, longo e regenerativo"
            )
            featureItem(
                icon: "chart.line.uptrend.xyaxis",
                iconColor: AthlyTheme.Color.success,
                iconBg: AthlyTheme.Color.success.opacity(0.10),
                iconBorder: AthlyTheme.Color.success.opacity(0.22),
                title: "Evolução em tempo real",
                subtitle: "Pace, FC e progresso visual"
            )
        }
    }

    private func featureItem(
        icon: String,
        iconColor: Color,
        iconBg: Color,
        iconBorder: Color,
        title: String,
        subtitle: String
    ) -> some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(iconBg)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(iconBorder, lineWidth: 1)
                    )
                    .frame(width: 34, height: 34)
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(iconColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AthlyTheme.Typography.semibold(12))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                Text(subtitle)
                    .font(AthlyTheme.Typography.body(10))
                    .foregroundStyle(AthlyTheme.Color.textSecondary)
            }
            Spacer()
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 13)
        .background(AthlyTheme.Color.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                .stroke(AthlyTheme.Color.borderDark, lineWidth: 1)
        )
    }

    // MARK: - CTAs

    private var ctaSection: some View {
        VStack(spacing: 8) {
            Button { showRegister = true } label: {
                Text("Criar conta grátis")
                    .font(AthlyTheme.Typography.semibold(14))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(AthlyTheme.Gradient.brand)
                    .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
            }
            .buttonStyle(.plain)

            Button { showLogin = true } label: {
                Text("Já tenho uma conta")
                    .font(AthlyTheme.Typography.semibold(14))
                    .foregroundStyle(AthlyTheme.Color.textPrimary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(AthlyTheme.Color.surfaceCard)
                    .clipShape(RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: AthlyTheme.Radius.button, style: .continuous)
                            .stroke(AthlyTheme.Color.borderMid, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)

            Text("Ao continuar, você concorda com os Termos de Uso e Política de Privacidade")
                .font(AthlyTheme.Typography.body(9))
                .foregroundStyle(AthlyTheme.Color.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.top, 4)
        }
    }
}
