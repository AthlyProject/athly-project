import Foundation

/// Shared locale-aware numeric formatting for run distance, reused wherever
/// `RunSession`, `HealthKitRunItem` and `WatermarkData` render a "X.XX km" value.
/// `String(format: "%.2f", ...)` always uses `.` as the decimal separator (POSIX
/// locale) regardless of the device's region, which reads wrong for locales like
/// German that expect a comma (e.g. "2,50" instead of "2.50").
enum LocalizedFormatting {
    static func formattedDistanceKm(_ km: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = .current
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: km)) ?? String(format: "%.2f", km)
    }
}
