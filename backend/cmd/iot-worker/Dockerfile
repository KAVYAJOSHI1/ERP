FROM golang:1.22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o iot-worker .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/iot-worker ./
ENTRYPOINT ["./iot-worker"]
