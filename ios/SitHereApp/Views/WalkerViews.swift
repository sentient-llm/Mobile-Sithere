import CoreLocation
import SwiftUI

struct WalkerJobsView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            List {
                Section("Booking workflow") {
                    Label("Accept or decline assigned walk requests from push or deep links.", systemImage: "checkmark.circle")
                    Label("Accepted jobs can start a live walk session.", systemImage: "figure.walk")
                    Label("Completed walks unlock report-card submission.", systemImage: "doc.text")
                }
                Section("Availability") {
                    Text(model.me?.walkerProfile?.availability.capitalized ?? "Available")
                    Text("Availability writes to the production walker profile endpoint in the next UI pass.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Jobs")
        }
    }
}

struct WalkerLiveWalkView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject private var locationService: LocationService
    @State private var walkRequestId = ""
    @State private var session: WalkSession?
    @State private var startedAt: Date?

    init() {
        self.locationService = LocationService()
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Session") {
                    TextField("Walk request UUID", text: $walkRequestId)
                        .textInputAutocapitalization(.never)
                    if let session {
                        Text("Session: \(session.id.uuidString)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Location") {
                    Text("Permission: \(String(describing: locationService.authorizationStatus))")
                    if let location = locationService.latestLocation {
                        Text("Lat \(location.coordinate.latitude), Lng \(location.coordinate.longitude)")
                            .font(.footnote)
                    }
                    Button("Allow Location") { locationService.requestWhenInUse() }
                    Button(session == nil ? "Start Walk" : "Post Current Location") {
                        Task { await startOrPost() }
                    }
                }

                Section("End of walk") {
                    NavigationLink("Submit Report") {
                        SubmitReportView(session: session)
                    }
                    .disabled(session == nil)
                }
            }
            .navigationTitle("Live Walk")
        }
    }

    private func startOrPost() async {
        do {
            let token = try model.tokenOrThrow()
            if session == nil {
                guard let requestId = UUID(uuidString: walkRequestId) else { return }
                session = try await model.apiClient.startWalkSession(token: token, walkRequestId: requestId)
                startedAt = Date()
                locationService.startWalkTracking()
                return
            }
            guard let session, let location = locationService.latestLocation else { return }
            let elapsed = Int(Date().timeIntervalSince(startedAt ?? Date()))
            _ = try await model.apiClient.postLocation(
                token: token,
                sessionId: session.id,
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude,
                elapsed: elapsed,
                distance: 0
            )
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }
}

struct SubmitReportView: View {
    @EnvironmentObject private var model: AppModel
    var session: WalkSession?
    @State private var mood = "Happy"
    @State private var notes = ""

    var body: some View {
        Form {
            Picker("Mood", selection: $mood) {
                Text("Happy").tag("Happy")
                Text("Calm").tag("Calm")
                Text("Tired").tag("Tired")
                Text("Playful").tag("Playful")
            }
            TextEditor(text: $notes)
                .frame(minHeight: 140)
            Button("Submit Report") {
                Task { await submit() }
            }
            .disabled(session == nil || notes.isEmpty)
        }
        .navigationTitle("Report Card")
    }

    private func submit() async {
        guard let session else { return }
        do {
            _ = try await model.apiClient.sendReport(token: model.tokenOrThrow(), walkSessionId: session.id, mood: mood, notes: notes)
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }
}

struct EarningsView: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Earnings") {
                    LabeledContent("Today", value: "$0.00")
                    LabeledContent("This week", value: "$0.00")
                    LabeledContent("This month", value: "$0.00")
                }
                Section {
                    Text("The backend now has payments and payout tables. The next native pass should summarize completed reports and Stripe payout state here.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Earnings")
        }
    }
}
