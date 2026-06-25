# GoBridge: Type-Safe RPC for Go & React

GoBridge is an advanced, high-performance bridge that connects your Go backend with your React frontend. It eliminates the boilerplate of REST APIs by allowing you to call Go functions directly from TypeScript with full type safety, automatic code generation, and built-in caching.

## Features

- **Type Safety**: Full end-to-end typing. If you change a field in Go, TypeScript will immediately show an error in your React components.
- **Auto-Generation**: Your TypeScript client is automatically updated during development when you register new procedures.
- **Advanced Caching**: Built-in caching and revalidation logic via the `useBridge` hook.
- **Secure**: Handles custom headers, authentication, and error propagation out of the box.

---

## 1. Backend: Defining Procedures

Procedures are defined as Go functions with a specific signature:
`func(ctx context.Context, input In) (Out, error)`

### Define your structs
```go
type LoginInput struct {
    Username string `json:"username"`
    Password string `json:"password"`
}

type LoginOutput struct {
    Success bool   `json:"success"`
    Token   string `json:"token"`
}
```

### Implement the handler
```go
func (a *APIHandler) Login(ctx context.Context, in LoginInput) (LoginOutput, error) {
    if in.Username == "admin" {
        return LoginOutput{Success: true, Token: "abc"}, nil
    }
    return LoginOutput{}, errors.New("unauthorized")
}
```

### Register the procedure
In `internal/router/router.go`:
```go
bridge.Register(bridgeRegistry, "login", apiHandler.Login, "Authenticates a user.")
```

---

## 2. Frontend: Using the Client

GoBridge generates a `BridgeClient` class in `web/src/lib/bridge.ts`.

### Direct Calls (Mutations/One-offs)
Use the `API` instance for actions like submitting forms.

```tsx
import { API } from './lib/bridge';

const result = await API.login({ 
    username: "admin", 
    password: "password" 
});
console.log(result.token); // Fully typed!
```

### Using the Hook (Queries)
Use the `useBridge` hook for data fetching. It provides caching and loading states.

```tsx
import { useBridge } from './lib/bridge-hooks';

function Profile() {
  const { data, loading, error, refetch } = useBridge('getUser', { id: 1 });

  if (loading) return <p>Loading...</p>;
  return <div>Welcome, {data.name}</div>;
}
```

---

## 3. Configuration & Headers

You can configure the bridge (e.g., for Authorization headers) in your entry point (`main.tsx` or `App.tsx`).

```tsx
import { API } from './lib/bridge';

API.config.headers = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};
```

---

## 4. How it Works (Under the hood)

1. **Reflection**: The Go bridge uses reflection to inspect the input and output types of your handlers.
2. **Generation**: It generates TypeScript interfaces and a proxy class that uses `fetch` to call the backend.
3. **Routing**: A single multiplexed endpoint handles all RPC calls using POST requests.
4. **Dev Mode**: The generation is triggered automatically when the server starts in development mode.

## Troubleshooting

- **Types not updating?**: Ensure your Go server is running in `development` mode (`APP_ENV=development`).
- **Path issues**: Check that `GenerateTypescript` in `router.go` points to the correct location for your frontend.
