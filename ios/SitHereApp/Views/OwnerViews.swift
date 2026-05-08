import MapKit
import SwiftUI

struct OwnerHomeView: View {
    @EnvironmentObject private var model: AppModel
    @State private var petName = ""
    @State private var petBreed = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Your dogs") {
                    ForEach(model.me?.pets ?? []) { pet in
                        VStack(alignment: .leading) {
                            Text(pet.name).font(.headline)
                            Text(pet.breed ?? "Breed not set").foregroundStyle(.secondary)
                        }
                    }
                    HStack {
                        TextField("Dog name", text: $petName)
                        TextField("Breed", text: $petBreed)
                        Button("Add") {
                            Task {
                                do {
                                    let token = try model.tokenOrThrow()
                                    _ = try await model.apiClient.createPet(token: token, name: petName, breed: petBreed)
                                    petName = ""
                                    petBreed = ""
                                    await model.refreshMe()
                                } catch {
                                    model.errorMessage = error.localizedDescription
                                }
                            }
                        }
                        .disabled(petName.isEmpty)
                    }
                }

                Section("Next steps") {
                    Label("Schedule a walk with a verified walker.", systemImage: "calendar")
                    Label("Track active walks on the Live tab.", systemImage: "location")
                    Label("Review report cards after completion.", systemImage: "star")
                }
            }
            .navigationTitle("Owner Home")
            .toolbar { refreshButton }
        }
    }

    private var refreshButton: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button("Refresh") { Task { await model.refreshMe() } }
        }
    }
}

struct ScheduleWalkView: View {
    @EnvironmentObject private var model: AppModel
    @State private var walkers: [WalkerProfile] = []
    @State private var selectedPet: Pet?
    @State private var selectedWalker: WalkerProfile?
    @State private var startAt = Date().addingTimeInterval(3600)
    @State private var duration = 30
    @State private var address = ""
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Walk details") {
                    Picker("Dog", selection: $selectedPet) {
                        Text("Choose dog").tag(Optional<Pet>.none)
                        ForEach(model.me?.pets ?? []) { pet in
                            Text(pet.name).tag(Optional(pet))
                        }
                    }
                    DatePicker("Start", selection: $startAt, displayedComponents: [.date, .hourAndMinute])
                    Picker("Duration", selection: $duration) {
                        Text("20 min").tag(20)
                        Text("30 min").tag(30)
                        Text("45 min").tag(45)
                        Text("60 min").tag(60)
                    }
                    TextField("Pickup address", text: $address)
                }

                Section("Walkers") {
                    ForEach(walkers) { walker in
                        Button {
                            selectedWalker = walker
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(walker.profile?.fullName ?? "Walker").font(.headline)
                                    Text(walker.bio.isEmpty ? "Reliable local walker" : walker.bio)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(walker.rateCents.currency)
                            }
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(selectedWalker?.id == walker.id ? Color.teal.opacity(0.12) : nil)
                    }
                }

                Section {
                    Button("Request Walk") {
                        Task { await submit() }
                    }
                    .disabled(selectedPet == nil || selectedWalker == nil || address.isEmpty || isLoading)
                }
            }
            .navigationTitle("Schedule Walk")
            .task { await loadWalkers() }
        }
    }

    private func loadWalkers() async {
        do {
            walkers = try await model.apiClient.walkers(token: model.tokenOrThrow())
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }

    private func submit() async {
        guard let selectedPet, let selectedWalker else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try model.tokenOrThrow()
            _ = try await model.apiClient.createWalkRequest(token: token, petId: selectedPet.id, walkerId: selectedWalker.id, startAt: startAt, duration: duration, address: address)
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }
}

struct OwnerLiveWalkView: View {
    @EnvironmentObject private var model: AppModel
    @State private var sessionIdText = ""
    @State private var location: LiveLocation?

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                TextField("Walk session UUID", text: $sessionIdText)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                Button("Load Live Location") {
                    Task { await load() }
                }
                if let location {
                    Map(initialPosition: .region(MKCoordinateRegion(
                        center: CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude),
                        span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                    ))) {
                        Marker("Walker", coordinate: CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude))
                    }
                    .frame(minHeight: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    Text("\(location.distanceMiles, specifier: "%.2f") mi, \(location.elapsedSeconds / 60) min")
                        .foregroundStyle(.secondary)
                } else {
                    ContentUnavailableView("No active live walk", systemImage: "map", description: Text("Enter a session id from an active walk to view location."))
                }
                Spacer()
            }
            .padding()
            .navigationTitle("Live Walk")
        }
    }

    private func load() async {
        guard let id = UUID(uuidString: sessionIdText) else { return }
        do {
            location = try await model.apiClient.liveLocation(token: model.tokenOrThrow(), sessionId: id)
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }
}

extension Int {
    var currency: String {
        let dollars = Double(self) / 100
        return dollars.formatted(.currency(code: "USD"))
    }
}
