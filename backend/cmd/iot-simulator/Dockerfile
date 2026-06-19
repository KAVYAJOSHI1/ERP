FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o iot-simulator main.go

FROM scratch
COPY --from=builder /app/iot-simulator /iot-simulator
ENTRYPOINT ["/iot-simulator"]
